"""
U.S. Refinery Utilization Weekly Report — Automated
- EIA API v2에서 주간 가동률 데이터 자동 fetch
- Anthropic Claude API로 변동 사유 자동 분석
- 계절성 차트 + PDF 생성
- Gmail SMTP 이메일 발송
"""

import os, io, datetime, smtplib, base64, json, requests
from collections import defaultdict
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER

from pdf2image import convert_from_bytes
from PIL import Image as PILImage

# ── 환경변수 (GitHub Secrets) ────────────────────────────────────────────────
EIA_API_KEY    = os.environ.get("EIA_API_KEY", "")
ANTHROPIC_KEY  = os.environ.get("ANTHROPIC_API_KEY", "")
GMAIL_USER     = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PWD  = os.environ.get("GMAIL_APP_PWD", "")
TO_EMAIL       = os.environ.get("TO_EMAIL", "realhdh@sk.com")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. EIA API — 주간 가동률 데이터 fetch
# ═══════════════════════════════════════════════════════════════════════════════
def fetch_eia_refinery_utilization(api_key):
    """EIA API v2 via SeriesID translation — WPULEUS3"""
    url = "https://api.eia.gov/v2/seriesid/PET.WPULEUS3.W"
    all_records = []
    offset = 0
    while True:
        params = {
            "api_key": api_key,
            "data[0]": "value",
            "sort[0][column]": "period",
            "sort[0][direction]": "asc",
            "offset": offset,
            "length": 5000,
            "start": "2022-01-01",
        }
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        records = data["response"]["data"]
        if not records:
            break
        all_records.extend(records)
        if len(records) < 5000:
            break
        offset += 5000
    return all_records


def organize_by_year(records):
    """EIA 레코드 → {year: {week_num: value}} 딕셔너리"""
    by_year = defaultdict(dict)
    for r in records:
        period = r["period"]  # "2026-04-10"
        val = float(r["value"])
        dt = datetime.date.fromisoformat(period)
        yr = dt.year
        week_num = dt.isocalendar()[1]
        # 연말 53주 → 52주로 합치기
        if week_num > 52:
            week_num = 52
        by_year[yr][week_num] = val
    return dict(by_year)


def build_week_dates(records, target_year):
    """2026년 각 주별 (week_num, week_ending_date, release_date) 리스트 생성"""
    week_dates = []
    for r in records:
        dt = datetime.date.fromisoformat(r["period"])
        if dt.year != target_year:
            continue
        week_num = dt.isocalendar()[1]
        if week_num > 52:
            week_num = 52
        # release date = week ending + 5 days (수요일 발표)
        release_dt = dt + datetime.timedelta(days=5)
        week_dates.append((
            week_num,
            dt.strftime("%m/%d"),
            release_dt.strftime("%m/%d"),
        ))
    # 중복 제거, 주차순 정렬
    seen = set()
    unique = []
    for item in week_dates:
        if item[0] not in seen:
            seen.add(item[0])
            unique.append(item)
    unique.sort(key=lambda x: x[0])
    return unique


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Anthropic Claude API — 변동 사유 자동 분석
# ═══════════════════════════════════════════════════════════════════════════════
def analyze_drivers(api_key, by_year, cur_year, week_dates):
    """Claude API로 최근 가동률 변동 사유 분석 → 3줄 bullet points"""
    if not api_key:
        return [
            "<b>Note:</b> ANTHROPIC_API_KEY not set. Driver analysis unavailable."
        ]

    vals = by_year.get(cur_year, {})
    if not vals:
        return ["<b>Note:</b> No current year data available."]

    # 최근 6주 데이터 준비
    sorted_weeks = sorted(vals.keys())
    recent = sorted_weeks[-6:]
    data_str = ", ".join(
        f"W{w}: {vals[w]:.1f}%" for w in recent
    )
    latest_w = recent[-1]
    latest_v = vals[latest_w]

    # 같은 주 과거 비교
    comps = []
    for yr in [cur_year - 1, cur_year - 2]:
        if yr in by_year and latest_w in by_year[yr]:
            diff = latest_v - by_year[yr][latest_w]
            comps.append(f"{yr}: {diff:+.1f}%p")

    # 마지막 주 ending date
    end_date = ""
    for wd in week_dates:
        if wd[0] == latest_w:
            end_date = wd[1]

    prompt = f"""You are an energy market analyst. Based on the following U.S. refinery utilization data,
provide exactly 3 concise bullet points explaining the key drivers of the recent utilization changes.

Data (recent 6 weeks of {cur_year}): {data_str}
Latest: W{latest_w} (week ending {end_date}) = {latest_v:.1f}%
Same-week YoY comparison: {', '.join(comps) if comps else 'N/A'}

Consider these potential factors:
- Crude oil import changes (Strait of Hormuz disruptions, US blockade of Iran)
- Spring turnaround / planned maintenance season
- Refinery closures (Phillips 66 Wilmington, Valero Benicia)
- Crude oil price impacts on refinery economics
- Weather events or unplanned outages
- Demand-side factors (driving season approach, product crack spreads)

Format each bullet as: <b>Factor name:</b> One-sentence explanation with specific data if possible.
Return ONLY the 3 bullets, no intro or conclusion. Keep each bullet under 40 words."""

    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 500,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30,
        )
        resp.raise_for_status()
        text = resp.json()["content"][0]["text"].strip()
        # 각 bullet을 파싱
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        # "•" 또는 "-" 로 시작하는 줄만 추출
        bullets = []
        for l in lines:
            clean = l.lstrip("•-– ").strip()
            if clean:
                bullets.append(clean)
        return bullets[:3] if bullets else [text]
    except Exception as e:
        print(f"⚠️ Claude API error: {e}")
        return [
            f"<b>API Error:</b> Could not retrieve driver analysis ({e})"
        ]


# ═══════════════════════════════════════════════════════════════════════════════
# 3. 차트 생성
# ═══════════════════════════════════════════════════════════════════════════════
def build_chart(by_year, cur_year):
    """계절성 차트 PNG → BytesIO"""
    fig, ax = plt.subplots(figsize=(10, 5.5))

    year_colors = {
        cur_year - 4: "#a0a0a0",
        cur_year - 3: "#7fb3d3",
        cur_year - 2: "#6aa84f",
        cur_year - 1: "#e6a817",
    }

    for yr in sorted(year_colors.keys()):
        if yr not in by_year:
            continue
        weeks_data = sorted(by_year[yr].items())
        ws = [w for w, v in weeks_data]
        vs = [v for w, v in weeks_data]
        ax.plot(ws, vs, color=year_colors[yr], linewidth=1.2,
                alpha=0.65, label=str(yr))

    # 현재 연도 — 빨간 실선 + 점
    if cur_year in by_year:
        weeks_data = sorted(by_year[cur_year].items())
        ws = [w for w, v in weeks_data]
        vs = [v for w, v in weeks_data]
        ax.plot(ws, vs, color="#d62728", linewidth=2.0,
                label=str(cur_year), zorder=5)
        ax.scatter(ws, vs, color="#d62728",
                   s=20, zorder=6, edgecolors="white", linewidths=0.8)
        # 최신 포인트 크게
        ax.scatter([ws[-1]], [vs[-1]], color="#d62728",
                   s=50, zorder=7, edgecolors="white", linewidths=1.5)
        ax.annotate(f'{vs[-1]:.1f}%',
                    xy=(ws[-1], vs[-1]),
                    xytext=(ws[-1] + 1.5, vs[-1] + 0.8),
                    fontsize=9, fontweight='bold', color='#d62728')

    # X축 월 표시
    month_ticks = [1, 5, 9, 14, 18, 23, 27, 31, 36, 40, 44, 49]
    month_labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    ax.set_xticks(month_ticks)
    ax.set_xticklabels(month_labels, fontsize=9)
    ax.set_xlabel("")
    ax.set_ylabel("Utilization Rate (%)", fontsize=10)
    ax.set_title("U.S. Refinery Utilization — Seasonal Comparison",
                 fontsize=13, fontweight='bold', pad=12)
    ax.set_xlim(1, 52)
    ax.set_ylim(78, 100)
    ax.yaxis.set_major_formatter(ticker.FormatStrFormatter('%.0f%%'))
    ax.grid(True, alpha=0.25)
    ax.legend(loc='lower right', fontsize=9, framealpha=0.9)

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=180, bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return buf


# ═══════════════════════════════════════════════════════════════════════════════
# 4. PDF 생성
# ═══════════════════════════════════════════════════════════════════════════════
def build_pdf(chart_buf, by_year, cur_year, week_dates, drivers):
    """PDF → bytes"""
    pdf_buf = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buf, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=15*mm, bottomMargin=15*mm,
    )
    styles = getSampleStyleSheet()
    title_s = ParagraphStyle('T', parent=styles['Title'],
        fontSize=16, leading=18, alignment=TA_CENTER, spaceAfter=2)
    sub_s = ParagraphStyle('S', parent=styles['Normal'],
        fontSize=9.5, leading=12, alignment=TA_CENTER,
        textColor=colors.HexColor("#555555"), spaceAfter=6)
    body_s = ParagraphStyle('B', parent=styles['Normal'],
        fontSize=9, leading=12, spaceAfter=2)
    sec_s = ParagraphStyle('Sec', parent=styles['Heading2'],
        fontSize=11, leading=13, spaceBefore=4, spaceAfter=2,
        textColor=colors.HexColor("#1a1a1a"))
    drv_s = ParagraphStyle('D', parent=styles['Normal'],
        fontSize=8.5, leading=11, spaceAfter=1)
    ftr_s = ParagraphStyle('F', parent=styles['Normal'],
        fontSize=7.5, leading=10, textColor=colors.HexColor("#888888"),
        alignment=TA_CENTER)

    story = []
    report_date = datetime.date.today().strftime("%B %d, %Y")

    # 타이틀
    story.append(Paragraph(
        "U.S. Refinery Utilization — Seasonal Analysis", title_s))
    story.append(Paragraph(
        f"Weekly Percent Utilization of Refinery Operable Capacity, "
        f"{cur_year-4}–{cur_year} YTD&nbsp;&nbsp;|&nbsp;&nbsp;"
        f"EIA Weekly Petroleum Status Report&nbsp;&nbsp;|&nbsp;&nbsp;"
        f"Generated: {report_date}", sub_s))

    # 차트
    story.append(Image(chart_buf, width=165*mm, height=82*mm))
    story.append(Spacer(1, 3))

    # Key Observations
    story.append(Paragraph("Key Observations", sec_s))
    vals = by_year.get(cur_year, {})
    if vals:
        sorted_w = sorted(vals.keys())
        latest_w = sorted_w[-1]
        latest_v = vals[latest_w]
        prev_v = vals[sorted_w[-2]] if len(sorted_w) >= 2 else latest_v
        chg = latest_v - prev_v
        chg_s = "+" if chg >= 0 else ""

        # 주 ending date
        end_d = ""
        for wd in week_dates:
            if wd[0] == latest_w:
                end_d = wd[1]

        comps = []
        for yr in [cur_year-1, cur_year-2, cur_year-3, cur_year-4]:
            if yr in by_year and latest_w in by_year[yr]:
                d = latest_v - by_year[yr][latest_w]
                comps.append(f"{yr}: {'+' if d>=0 else ''}{d:.1f}%p")

        obs = (f"• Latest (W{latest_w:02d}, week ending {end_d}): "
               f"<b>{latest_v:.1f}%</b> ({chg_s}{chg:.1f}%p WoW)<br/>"
               f"• Same-week comparison — {', '.join(comps)}<br/>")
        if latest_v < 90.0:
            obs += ("• Current rate is <b>notably below typical spring levels</b> "
                    "(historically 90–93%), reflecting feedstock supply constraints.")
        elif latest_v < 92.0:
            obs += ("• Current utilization is in the <b>low-normal range</b>, "
                    "with spring maintenance overlapping supply disruptions.")
        else:
            obs += ("• Utilization is at <b>seasonally normal levels</b>, "
                    "consistent with ramp-up ahead of summer driving season.")
        story.append(Paragraph(obs, body_s))
    story.append(Spacer(1, 2))

    # Utilization Change Drivers (AI 분석)
    story.append(Paragraph("Utilization Change Drivers", sec_s))
    for d in drivers:
        story.append(Paragraph(d, drv_s))
    story.append(Spacer(1, 4))

    # Recent Weekly Data 테이블
    story.append(Paragraph("Recent Weekly Data", sec_s))
    tbl_data = [["Week", "Week Ending", "Release Date", "Utilization (%)", "WoW Change"]]
    if vals and week_dates:
        sorted_w = sorted(vals.keys())
        show_weeks = sorted_w[-8:]
        for w in show_weeks:
            v = vals[w]
            # find dates
            end_d, rel_d = "", ""
            for wd in week_dates:
                if wd[0] == w:
                    end_d, rel_d = wd[1], wd[2]
                    break
            # WoW
            prev_w_idx = sorted_w.index(w)
            if prev_w_idx > 0:
                pv = vals[sorted_w[prev_w_idx - 1]]
                wow = v - pv
                wow_s = f"{'+' if wow>=0 else ''}{wow:.1f}%p"
            else:
                wow_s = "—"
            tbl_data.append([f"W{w:02d}", end_d, rel_d, f"{v:.1f}%", wow_s])

    tbl = Table(tbl_data, colWidths=[22*mm, 28*mm, 28*mm, 32*mm, 26*mm])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2c3e50")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8),
        ('FONTSIZE', (0,1), (-1,-1), 8.5),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#dddddd")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1),
         [colors.white, colors.HexColor("#f7f9fc")]),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#ffeaea")),
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 4))

    # Footer
    story.append(Paragraph(
        "Source: U.S. Energy Information Administration (EIA) — "
        "Weekly Petroleum Status Report (WPULEUS3).<br/>"
        "Driver analysis generated by Claude AI based on EIA data and recent market context.<br/>"
        "This report is for informational purposes only.", ftr_s))

    doc.build(story)
    return pdf_buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 5. 이메일 본문 (PDF 인라인 이미지) + 발송
# ═══════════════════════════════════════════════════════════════════════════════
def pdf_to_inline_html(pdf_bytes):
    images = convert_from_bytes(pdf_bytes, dpi=150)
    img_buf = io.BytesIO()
    images[0].save(img_buf, format='PNG')
    b64 = base64.b64encode(img_buf.getvalue()).decode()

    return f"""<html><body style="margin:0;padding:0;background:#f5f5f5;">
<div style="max-width:680px;margin:20px auto;background:#fff;
border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;">
  <div style="background:#1a3a5c;padding:16px 24px;">
    <h2 style="color:#fff;margin:0;font-size:18px;">
      U.S. Refinery Utilization — Weekly Report</h2>
    <p style="color:#b0c4de;margin:4px 0 0;font-size:12px;">
      EIA Weekly Petroleum Status Report | {datetime.date.today().strftime('%B %d, %Y')}</p>
  </div>
  <div style="padding:16px 24px;">
    <img src="data:image/png;base64,{b64}"
         style="width:100%;max-width:640px;border:1px solid #eee;"
         alt="U.S. Refinery Utilization Report"/>
  </div>
  <div style="background:#f7f9fc;padding:12px 24px;border-top:1px solid #e0e0e0;">
    <p style="color:#999;font-size:11px;margin:0;line-height:1.5;">
      Source: U.S. EIA WPULEUS3. For informational purposes only.</p>
  </div>
</div></body></html>"""


def send_email(html_body, pdf_bytes, gmail_user, app_pwd, to):
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    subject = f"[Weekly Report] U.S. Refinery Utilization — {today_str}"

    msg = MIMEMultipart("mixed")
    msg["From"] = gmail_user
    msg["To"] = to
    msg["Subject"] = subject

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(html_body, "html", "utf-8"))
    msg.attach(alt)

    pdf_part = MIMEBase("application", "pdf")
    pdf_part.set_payload(pdf_bytes)
    encoders.encode_base64(pdf_part)
    fname = f"us_refinery_utilization_{today_str}.pdf"
    pdf_part.add_header("Content-Disposition", "attachment", filename=fname)
    msg.attach(pdf_part)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(gmail_user, app_pwd)
        server.sendmail(gmail_user, to, msg.as_bytes())
    print(f"✅ Email sent to {to}")


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    cur_year = datetime.date.today().year

    print("[1/6] Fetching EIA refinery utilization data...")
    records = fetch_eia_refinery_utilization(EIA_API_KEY)
    by_year = organize_by_year(records)
    print(f"      Years: {sorted(by_year.keys())}")
    if cur_year in by_year:
        latest_w = max(by_year[cur_year].keys())
        latest_v = by_year[cur_year][latest_w]
        print(f"      {cur_year} latest: W{latest_w} = {latest_v:.1f}%")

    print("[2/6] Building week dates...")
    week_dates = build_week_dates(records, cur_year)
    print(f"      {cur_year} weeks: {len(week_dates)}")

    print("[3/6] Analyzing utilization drivers (Claude AI)...")
    drivers = analyze_drivers(ANTHROPIC_KEY, by_year, cur_year, week_dates)
    for i, d in enumerate(drivers):
        print(f"      Driver {i+1}: {d[:80]}...")

    print("[4/6] Building chart...")
    chart_buf = build_chart(by_year, cur_year)

    print("[5/6] Building PDF...")
    pdf_bytes = build_pdf(chart_buf, by_year, cur_year, week_dates, drivers)

    print("[6/6] Sending email...")
    html_body = pdf_to_inline_html(pdf_bytes)
    send_email(html_body, pdf_bytes, GMAIL_USER, GMAIL_APP_PWD, TO_EMAIL)
    print("✅ Done.")
