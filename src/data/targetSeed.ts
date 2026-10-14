import type { AimingPoint, Target } from "@/types/target";

const created = "2026-03-01T08:00:00.000Z";

export const TARGET_1_ID = "a1111111-1111-4111-8111-111111111111";
export const TARGET_2_ID = "a2222222-2222-4222-8222-222222222222";
export const AP_1_ID = "b1111111-1111-4111-8111-111111111111";
export const AP_2_ID = "b2222222-2222-4222-8222-222222222222";
export const AP_3_ID = "b3333333-3333-4333-8333-333333333333";

export const SEED_TARGETS: Target[] = [
  {
    id: TARGET_1_ID,
    label: "MT1",
    displayed_id: "",
    name: "КСП 45-ї ОМБр",
    address: "Краматорськ, Донецька область, Україна",
    type: "КСП",
    distance_from_hot_line: 12.5,
    mgrs: "36U EV 45210 88320",
    created_at: created,
    updated_at: created,
    archived_at: null,
    aiming_point_ids: [AP_1_ID, AP_2_ID],
    image_url: null,
  },
  {
    id: TARGET_2_ID,
    label: "MT2",
    displayed_id: "",
    name: "Склад БК південний",
    address: "Оріхів, Запорізька область, Україна",
    type: "Склад БК",
    distance_from_hot_line: 28,
    created_at: created,
    updated_at: created,
    archived_at: null,
    mgrs: "36U EV 12890 44102",
    aiming_point_ids: [AP_3_ID],
    image_url: null,
  },
];

export const SEED_AIMING_POINTS: AimingPoint[] = [
  {
    id: AP_1_ID,
    target_id: TARGET_1_ID,
    label: "AP1",
    displayed_id: "",
    name: "Командний вхід",
    mgrs: "36U EV 45220 88325",
    agl_msl: 12,
    feat_hgt_msl: 18,
    created_at: created,
    updated_at: created,
    archived_at: null,
  },
  {
    id: AP_2_ID,
    target_id: TARGET_1_ID,
    label: "AP2",
    displayed_id: "",
    name: "Антенна щогла",
    mgrs: "36U EV 45230 88340",
    agl_msl: 20,
    feat_hgt_msl: 35,
    created_at: created,
    updated_at: created,
    archived_at: null,
  },
  {
    id: AP_3_ID,
    target_id: TARGET_2_ID,
    label: "AP3",
    displayed_id: "MP01",
    name: "Ворота складу",
    mgrs: "36U EV 12900 44110",
    agl_msl: 8,
    feat_hgt_msl: 14,
    created_at: created,
    updated_at: created,
    archived_at: null,
  },
];
