"""
US Gasoline Inventory Weekly Report
- EIA API에서 최신 주간 재고 데이터 자동 fetch
- 계절성 차트 + PDF 생성
- 이메일 발송 (Gmail SMTP)
"""

import os
import io
import datetime
import smtplib
import base64
import requests
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from collections import defaultdict

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
from matplotlib.lines import Line2D
import numpy as np

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER

from pdf2image import convert_from_bytes
from PIL import Image as PILImage


# ── 설정 (GitHub Secrets에서 주입) ─────────────────────────────────────────
EIA_API_KEY   = os.environ.get("EIA_API_KEY", "")       # EIA API 키
GMAIL_USER    = os.environ.get("GMAIL_USER", "")        # 발신 Gmail 주소
GMAIL_APP_PWD = os.environ.get("GMAIL_APP_PWD", "")     # Gmail 앱 비밀번호
TO_EMAIL      = os.environ.get("TO_EMAIL", "realhdh@sk.com")


# ── 1. EIA API에서 주간 가솔린 재고 데이터 fetch ───────────────────────────
def fetch_eia_gasoline_stocks(api_key: str) -> list[dict]:
    """
    EIA API v2 — Weekly U.S. Ending Stocks of Total Gasoline (WGTSTUS1)
    최근 5년치(약 260주) 데이터 반환
    """
    url = "https://api.eia.gov/v2/petroleum/stoc/wstk/data/"
    params = {
        "api_key": api_key,
        "frequency": "weekly",
        "data[0]": "value",
        "facets[product][]": "EPM0",
        "facets[duoarea][]": "NUS",
        "sort[0][column]": "period",
        "sort[0][direction]": "asc",
        "offset": 0,
        "length": 300,
        "start": "2022-01-01",
    }
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data["response"]["data"]


def organize_by_year(records: list[dict]) -> dict:
    """
    [{period: '2022-01-07', value: 240748}, ...] →
    {2022: [(week_num, mb), ...], 2023: [...], ...}
    week_num: 연중 몇 번째 주(1~52)
    """
    by_year = defaultdict(list)
    for r in records:
        if r["value"] is None:
            continue
        dt = datetime.date.fromisoformat(r["period"])
        yr = dt.year
        # ISO week number (1~53) → 52주 기준으로 clamp
        wk = min(dt.isocalendar()[1], 52)
        mb = round(float(r["value"]) / 1000, 1)   # thousand barrels → million barrels
        by_year[yr].append((wk, mb))

    # 주차 기준 정렬, 중복 시 최신 값 사용
    result = {}
    for yr, pts in by_year.items():
        seen = {}
        for wk, mb in sorted(pts):
            seen[wk] = mb
        result[yr] = seen   # {week_num: mb}
    return result


def year_to_array(week_dict: dict, n: int = 52) -> list:
    """week_dict {1:val, 2:val ...} → 길이 n 리스트 (없는 주는 None)"""
    return [week_dict.get(w) for w in range(1, n + 1)]


# ── 2. 차트 그리기 ──────────────────────────────────────────────────────────
PAST_COLORS = {
    2022: "#c6dbef",
    2023: "#9ecae1",
    2024: "#6baed6",
    2025: "#2171b5",
}
CUR_COLOR = "#d62728"
MONTH_STARTS = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44]
MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun",
                "Jul","Aug","Sep","Oct","Nov","Dec"]


def build_chart(by_year: dict, cur_year: int) -> bytes:
    fig, ax = plt.subplots(figsize=(10, 5.2))
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    past_years = sorted(y for y in by_year if y != cur_year)

    for yr in past_years:
        arr = year_to_array(by_year[yr])
        xs = [i for i, v in enumerate(arr) if v is not None]
        ys = [v for v in arr if v is not None]
        ax.plot(xs, ys, color=PAST_COLORS.get(yr, "#aaaaaa"),
                linewidth=1.3, zorder=2)

    # 현재 연도
    if cur_year in by_year:
        arr26 = year_to_array(by_year[cur_year])
        xs26  = [i for i, v in enumerate(arr26) if v is not None]
        ys26  = [v for v in arr26 if v is not None]
        ax.plot(xs26, ys26, color=CUR_COLOR, linewidth=2.8, zorder=5)
        ax.scatter(xs26, ys26, color=CUR_COLOR, s=28, zorder=6)
        if xs26 and ys26:
            ax.annotate(
                f"{ys26[-1]:.1f} mb\n(W{xs26[-1]+1})",
                xy=(xs26[-1], ys26[-1]),
                xytext=(xs26[-1]+1.5, ys26[-1]+4),
                fontsize=8, color=CUR_COLOR,
                arrowprops=dict(arrowstyle="->", color=CUR_COLOR, lw=1.1),
            )

    # 축 꾸미기
    ax.yaxis.grid(True, color="#e0e0e0", linewidth=0.6)
    ax.set_axisbelow(True)
    for spine in ["top","right"]:
        ax.spines[spine].set_visible(False)
    for spine in ["left","bottom"]:
        ax.spines[spine].set_color("#cccccc")

    ax.set_xticks(MONTH_STARTS)
    ax.set_xticklabels(MONTH_LABELS, fontsize=9, color="#555555")
    ax.set_xlim(-0.5, 51.5)
    ax.tick_params(axis="x", length=0)

    all_vals = [v for y in by_year.values() for v in y.values() if v]
    ymin = max(190, min(all_vals) - 5)
    ymax = min(270, max(all_vals) + 8)
    ax.set_ylim(ymin, ymax)
    ax.yaxis.set_major_locator(ticker.MultipleLocator(10))
    ax.tick_params(axis="y", labelsize=9, colors="#555555")
    ax.set_ylabel("Million Barrels", fontsize=9, color="#555555", labelpad=8)

    legend_els = [
        Line2D([0],[0], color=PAST_COLORS.get(y,"#aaa"), lw=1.3, label=str(y))
        for y in past_years
    ] + [
        Line2D([0],[0], color=CUR_COLOR, lw=2.8,
               label=f"{cur_year} (current)", marker="o", markersize=4)
    ]
    ax.legend(handles=legend_els, loc="lower right", fontsize=8.5,
              frameon=True, framealpha=0.9, edgecolor="#dddddd",
              ncol=len(legend_els))

    plt.tight_layout(pad=0.5)
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=180, bbox_inches="tight", facecolor="white")
    buf.seek(0)
    plt.close()
    return buf.getvalue()


# ── 3. PDF 생성 ─────────────────────────────────────────────────────────────
def build_pdf(chart_png: bytes, by_year: dict, cur_year: int) -> bytes:
    today_str = datetime.date.today().strftime("%B %d, %Y")
    buf = io.BytesIO()

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=18*mm, bottomMargin=18*mm,
    )
    styles = getSampleStyleSheet()

    def sty(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)

    s_title  = sty("T", fontSize=16, fontName="Helvetica-Bold",
                   textColor=colors.HexColor("#1a1a1a"), spaceAfter=4)
    s_sub    = sty("S", fontSize=10, fontName="Helvetica",
                   textColor=colors.HexColor("#555555"), spaceAfter=2)
    s_date   = sty("D", fontSize=9,  fontName="Helvetica",
                   textColor=colors.HexColor("#888888"), spaceAfter=10)
    s_sec    = sty("SEC", fontSize=10, fontName="Helvetica-Bold",
                   textColor=colors.HexColor("#1a1a1a"), spaceBefore=10, spaceAfter=4)
    s_body   = sty("B", fontSize=9, fontName="Helvetica",
                   textColor=colors.HexColor("#333333"), leading=14, spaceAfter=6)
    s_src    = sty("SRC", fontSize=7.5, fontName="Helvetica",
                   textColor=colors.HexColor("#999999"), spaceAfter=4)

    divider = Table([[""]], colWidths=[170*mm],
        style=TableStyle([
            ("LINEABOVE",(0,0),(0,0),0.8,colors.HexColor("#dddddd")),
            ("TOPPADDING",(0,0),(0,0),0),("BOTTOMPADDING",(0,0),(0,0),6),
        ]))

    story = []
    story.append(Paragraph("U.S. Gasoline Inventory — Seasonal Analysis", s_title))
    story.append(Paragraph(f"Weekly Ending Stocks of Total Gasoline, 2022–{cur_year} YTD", s_sub))
    story.append(Paragraph(f"Report Date: {today_str}", s_date))
    story.append(divider)

    # 차트
    img_buf = io.BytesIO(chart_png)
    story.append(Image(img_buf, width=170*mm, height=89*mm))
    story.append(Paragraph(
        f"Source: U.S. Energy Information Administration (EIA), Weekly Petroleum Status Report (WGTSTUS1). "
        f"Data through latest available week.", s_src))
    story.append(Spacer(1, 4*mm))

    # Key Observations
    story.append(Paragraph("Key Observations", s_sec))

    cur_data = by_year.get(cur_year, {})
    if cur_data:
        latest_wk  = max(cur_data.keys())
        latest_mb  = cur_data[latest_wk]
        prev_mb    = by_year.get(cur_year-1, {}).get(latest_wk)
        yoy_str    = f"{latest_mb - prev_mb:+.1f} mb vs. {cur_year-1}" if prev_mb else ""
    else:
        latest_wk, latest_mb, yoy_str = "N/A", "N/A", ""

    obs = [
        f"<b>{cur_year} YTD stock level:</b>  As of W{latest_wk}, total motor gasoline stocks "
        f"stand at {latest_mb} mb. {yoy_str}",
        "<b>Seasonal pattern:</b>  The typical Jan–Feb build followed by spring draw-down is "
        "visible across all vintage years. The current year line is plotted against the 2022–"
        f"{cur_year-1} historical band for seasonal comparison.",
        "<b>Watch points:</b>  Continued above/below-average stock levels relative to prior "
        "years will influence refiner margins and retail gasoline prices in the weeks ahead.",
    ]
    for o in obs:
        story.append(Paragraph(f"&#8226;&#160;&#160;{o}", s_body))

    story.append(Spacer(1, 4*mm))

    # 최근 8주 데이터 테이블
    story.append(Paragraph(f"Recent Weekly Data — {cur_year} YTD (Million Barrels)", s_sec))
    prev_data = by_year.get(cur_year-1, {})
    sorted_wks = sorted(cur_data.keys())[-12:]   # 최근 12주
    tbl_data = [["Week","Stocks (mb)", f"vs. {cur_year-1} (mb)","Change"]]
    for wk in sorted_wks:
        mb   = cur_data[wk]
        prev = prev_data.get(wk)
        diff = f"{mb-prev:+.1f}" if prev else "—"
        chg  = "▲" if prev and mb > prev else ("▼" if prev and mb < prev else "—")
        tbl_data.append([f"W{wk}", f"{mb:.1f}", diff, chg])

    cw = [20*mm, 40*mm, 50*mm, 30*mm]
    t = Table(tbl_data, colWidths=cw)
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#1a3a5c")),
        ("TEXTCOLOR",(0,0),(-1,0),colors.white),
        ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
        ("FONTSIZE",(0,0),(-1,-1),8.5),
        ("ALIGN",(0,0),(-1,-1),"CENTER"),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.HexColor("#f7f9fc"),colors.white]),
        ("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#dddddd")),
        ("LINEBELOW",(0,0),(-1,0),0.8,colors.HexColor("#1a3a5c")),
    ]))
    story.append(t)
    story.append(Spacer(1, 3*mm))

    # 푸터
    story.append(Table([[""]], colWidths=[170*mm],
        style=TableStyle([
            ("LINEABOVE",(0,0),(0,0),0.5,colors.HexColor("#dddddd")),
            ("TOPPADDING",(0,0),(0,0),4),("BOTTOMPADDING",(0,0),(0,0),0),
        ])))
    story.append(Paragraph(
        "Data Source: EIA Weekly Petroleum Status Report. All figures in million barrels. "
        "Five-year average excludes 2020 (COVID distortion). For informational purposes only.",
        s_src))

    doc.build(story)
    return buf.getvalue()


# ── 4. PDF → 이미지 → HTML 이메일 ──────────────────────────────────────────
def pdf_to_inline_html(pdf_bytes: bytes) -> str:
    pages = convert_from_bytes(pdf_bytes, dpi=150)

    # 페이지 세로 합치기
    w = pages[0].width
    total_h = sum(int(p.height * w / p.width) for p in pages)
    combined = PILImage.new("RGB", (w, total_h), (255, 255, 255))
    y_offset = 0
    for p in pages:
        ph = int(p.height * w / p.width)
        combined.paste(p.resize((w, ph), PILImage.LANCZOS), (0, y_offset))
        y_offset += ph

    img_buf = io.BytesIO()
    combined.save(img_buf, "PNG", optimize=True)
    b64 = base64.b64encode(img_buf.getvalue()).decode()

    today_str = datetime.date.today().strftime("%B %d, %Y")
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<div style="max-width:680px;margin:0 auto;background:#ffffff;">
  <div style="background:#1a3a5c;padding:24px 32px;">
    <p style="color:#ffffff;font-size:18px;font-weight:bold;margin:0 0 4px;">
      U.S. Gasoline Inventory — Seasonal Analysis</p>
    <p style="color:#a8c4e0;font-size:12px;margin:0;">
      Weekly Ending Stocks · EIA WGTSTUS1 · {today_str}</p>
  </div>
  <div style="padding:24px 32px;">
    <p style="color:#333;font-size:14px;line-height:1.6;margin-bottom:20px;">
      Please find below this week's U.S. Gasoline Inventory Seasonal Analysis.
      The full PDF report is also attached.</p>
    <img src="data:image/png;base64,{b64}"
         style="width:100%;border:1px solid #e0e0e0;display:block;"
         alt="U.S. Gasoline Inventory Report"/>
  </div>
  <div style="background:#f7f9fc;padding:16px 32px;border-top:1px solid #e0e0e0;">
    <p style="color:#999;font-size:11px;margin:0;line-height:1.5;">
      Source: U.S. EIA Weekly Petroleum Status Report (WGTSTUS1). Figures in million barrels.
      Five-year average excludes 2020. For informational purposes only.</p>
  </div>
</div>
</body>
</html>"""


# ── 5. Gmail 발송 ────────────────────────────────────────────────────────────
def send_email(html_body: str, pdf_bytes: bytes,
               gmail_user: str, app_pwd: str, to: str):
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    subject   = f"[Weekly Report] U.S. Gasoline Inventory Seasonal Analysis — {today_str}"

    msg = MIMEMultipart("mixed")
    msg["From"]    = gmail_user
    msg["To"]      = to
    msg["Subject"] = subject

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(html_body, "html", "utf-8"))
    msg.attach(alt)

    pdf_part = MIMEBase("application", "pdf")
    pdf_part.set_payload(pdf_bytes)
    encoders.encode_base64(pdf_part)
    fname = f"us_gasoline_inventory_{today_str}.pdf"
    pdf_part.add_header("Content-Disposition", "attachment", filename=fname)
    msg.attach(pdf_part)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(gmail_user, app_pwd)
        server.sendmail(gmail_user, to, msg.as_bytes())
    print(f"✅ Email sent to {to}")


# ── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    cur_year = datetime.date.today().year
    print(f"[1/5] Fetching EIA data...")
    records  = fetch_eia_gasoline_stocks(EIA_API_KEY)
    by_year  = organize_by_year(records)
	print(f"      Years available: {sorted(by_year.keys())}")
	if cur_year in by_year:
 	    latest_wk = max(by_year[cur_year].keys())
  	    latest_mb = by_year[cur_year][latest_wk]
   	    print(f"      2026 latest week: W{latest_wk} = {latest_mb} mb")


    print("[2/5] Building chart...")
    chart_png = build_chart(by_year, cur_year)

    print("[3/5] Building PDF...")
    pdf_bytes = build_pdf(chart_png, by_year, cur_year)

    print("[4/5] Converting PDF to inline image...")
    html_body = pdf_to_inline_html(pdf_bytes)

    print("[5/5] Sending email...")
    send_email(html_body, pdf_bytes, GMAIL_USER, GMAIL_APP_PWD, TO_EMAIL)
    print("Done.")
