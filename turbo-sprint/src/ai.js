// ai.js — AI 컨트롤러: 스플라인 추종(룩어헤드) + 레인 오프셋 + 러버밴딩
import * as THREE from 'three';

const _fwd = new THREE.Vector3();
const _toT = new THREE.Vector3();
const _gr = {};

export class AIController {
  constructor(kart, track, laneOffset) {
    this.kart = kart;
    this.track = track;
    this.lane = laneOffset;         // -3 / 0 / +3 등
    this.input = { accel: false, brake: false, steer: 0, drift: false };
    this._itemCooldown = 1 + Math.abs(laneOffset); // 아이템 사용 텀
  }

  update(dt, player) {
    const k = this.kart, track = this.track;
    const N = track.samplePos.length;

    // 룩어헤드 목표점 (레인 오프셋 반영)
    const LOOK = 22;
    const li = (k.idx + LOOK) % N;
    const tp = track.samplePos[li], tl = track.sampleLat[li];
    // 중앙 분리대 구간에선 레인을 한쪽으로 (센터 회피)
    let lane = this.lane;
    if (track.sampleMedian[li] && Math.abs(lane) < 3) lane = (lane >= 0 ? 1 : -1) * 4.5;
    // 좁은 다리(용암 추락 위험)에선 정중앙으로 주행
    if (track.sampleBridge && (track.sampleBridge[li] || track.sampleBridge[k.idx])) lane = 0;
    // 성 등반(공중 도로): 좁고 낭떠러지 → 정중앙으로 주행 (바깥레인 이탈 방지)
    if (track.samplePos[li].y > 3 || track.samplePos[k.idx].y > 3) lane = 0;
    _toT.set(tp.x + tl.x * lane - k.pos.x, 0, tp.z + tl.z * lane - k.pos.z);
    if (_toT.lengthSq() > 1e-6) _toT.normalize();

    _fwd.copy(k.forward); _fwd.y = 0;
    if (_fwd.lengthSq() > 1e-6) _fwd.normalize();

    // 조향: 전방과 목표방향 사이 각
    // 카트 회전 규칙(rot = -steer·…, 목표까지 필요한 rot = -ang)상
    // steer 는 +ang 이어야 목표로 수렴한다. (이전 -ang 은 반대로 꺾여 버그)
    const crossY = _fwd.x * _toT.z - _fwd.z * _toT.x;
    const dot = THREE.MathUtils.clamp(_fwd.dot(_toT), -1, 1);
    const ang = Math.atan2(crossY, dot);
    // 크로스트랙 보정: 일정 곡률(나선 등반)에서 바깥으로 밀려 이탈하지 않도록
    // 현재 도로중심 대비 측면오차를 목표 레인으로 되돌리는 항 추가
    const gr = track.ground(k.pos, k.idx, _gr);
    const crossErr = gr.lateral - lane;            // +면 우측(바깥)으로 치우침
    // 성 등반(공중 도로)에선 가장자리 이탈 위험 → 중앙 복귀를 강하게
    const kcorr = gr.elevated ? 0.16 : 0.06;
    const correct = THREE.MathUtils.clamp(crossErr * kcorr, -1, 1);
    this.input.steer = THREE.MathUtils.clamp(ang * 2.4 - correct, -1, 1);

    // 곡률 기반 목표 속도 (앞쪽 접선 변화가 크면 감속)
    const a = track.sampleTan[k.idx];
    const b = track.sampleTan[(k.idx + 30) % N];
    const straightness = Math.max(0, a.dot(b));       // 1=직선, 낮을수록 급코너
    let targetFrac = 0.6 + 0.4 * straightness;

    // 러버밴딩: 뒤처지면 가속, 앞서면 완화
    if (player) {
      if (k.progress < player.progress - 0.02) targetFrac = 1.0;
      else if (k.progress > player.progress + 0.02) targetFrac *= 0.92;
    }
    const target = 28 * targetFrac; // maxSpeed 기준
    this.input.accel = Math.abs(k.speed) < target;
    this.input.brake = k.speed > target + 3;

    return this.input;
  }
}
