// ai.js — AI 컨트롤러: 스플라인 추종(룩어헤드) + 레인 오프셋 + 러버밴딩
import * as THREE from 'three';

const _fwd = new THREE.Vector3();
const _toT = new THREE.Vector3();

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
    this.input.steer = THREE.MathUtils.clamp(ang * 2.4, -1, 1);

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
