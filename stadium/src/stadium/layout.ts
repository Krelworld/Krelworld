// The stadium and its surroundings. Static data: never saved, never changes.
// Metres. The centre spot is (0, 0); y grows towards the south (down the screen).
import type { Access, Role } from "../core/types";

export interface Rect { x: number; y: number; w: number; h: number }
export interface Wall extends Rect {
  h3: number; colour: number; top: number;
  /** A gate that can be opened for someone. */
  gate?: string;
  /** Street furniture: solid, low, and drawn as a picture rather than a box. */
  prop?: boolean;
}
export interface Area extends Rect {
  id: string;
  name: string;
  access: Access;
  roles?: Role[];
  floor: number;
  /** Nobody can see in (toilet cubicles, inside the lorry). */
  private?: boolean;
  /** Seats: sitting here gives the spectator's view. */
  seats?: boolean;
  /** Part of the pitch or the grass around it. */
  pitch?: boolean;
  /** Outside the stadium walls. */
  outside?: boolean;
}

export const BOUNDS: Rect = { x: -92, y: -62, w: 184, h: 158 };

const r = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });

// Ground colours.
const C = {
  street: 0x3a3d42, pavement: 0x5b5e63, road: 0x2b2d31, concourse: 0x6a6258, stand: 0x3b4250,
  players: 0x4c5560, bar: 0x6b4a33, pub: 0x5a3b2a, toilet: 0x7d8a8f, grass: 0x2f7d3b, verge: 0x2b6a36,
  yard: 0x4a4740, cabin: 0x56604f, loading: 0x55524a, ticket: 0x4f5560, kitchen: 0x8b8f86, security: 0x464b5c,
};

/** Later areas sit on top of earlier ones; the last one that contains a point wins. */
const QF_AREAS: Area[] = [
  { id: "street", name: "Outside the ground", access: "public", floor: C.street, outside: true, ...r(-92, -62, 92, 96) },
  { id: "alley", name: "Service alley", access: "public", floor: 0x47484a, outside: true, ...r(-70, -62, -57, 84) },
  { id: "plaza", name: "Stadium approach", access: "public", floor: C.pavement, outside: true, ...r(-60, 45, 60, 60) },
  { id: "road", name: "Ring road", access: "public", floor: C.road, outside: true, ...r(-92, 84, 92, 92) },
  { id: "eastroad", name: "Service road", access: "public", floor: C.road, outside: true, ...r(62, -50, 72, 92) },

  // The ground itself.
  { id: "concourse_s", name: "South concourse", access: "ticket", floor: C.concourse, ...r(-56, 38, 56, 44) },
  { id: "concourse_w", name: "West concourse", access: "ticket", floor: C.concourse, ...r(-56, -38, -50, 44) },
  { id: "concourse_e", name: "East concourse", access: "ticket", floor: C.concourse, ...r(50, -38, 56, 44) },
  { id: "stand_s", name: "South Stand", access: "ticket", floor: C.stand, seats: true, ...r(-40, 28, 40, 38) },
  { id: "stand_w", name: "West End", access: "ticket", floor: C.stand, seats: true, ...r(-50, -27, -41, 27) },
  { id: "stand_e", name: "East End (away fans)", access: "ticket", floor: C.stand, seats: true, ...r(41, -27, 50, 27) },
  { id: "stand_n", name: "Main Stand", access: "ticket", floor: C.stand, seats: true, ...r(-40, -38, 40, -28) },
  { id: "corner_sw", name: "South concourse", access: "ticket", floor: C.concourse, ...r(-50, 27, -40, 38) },
  { id: "corner_se", name: "South concourse", access: "ticket", floor: C.concourse, ...r(40, 27, 50, 38) },
  { id: "corner_nw", name: "West concourse", access: "ticket", floor: C.concourse, ...r(-50, -38, -40, -27) },
  { id: "corner_ne", name: "East concourse", access: "ticket", floor: C.concourse, ...r(40, -38, 50, -27) },
  { id: "verge", name: "Pitchside", access: "pitch", roles: ["steward", "police", "medic", "footballer", "referee", "broadcaster", "mascot"], floor: C.verge, pitch: true, ...r(-41, -28, 41, 28) },
  { id: "pitch", name: "The pitch", access: "pitch", roles: ["footballer", "referee"], floor: C.grass, pitch: true, ...r(-36, -23, 36, 23) },
  { id: "tunnel", name: "Players' tunnel", access: "restricted", roles: ["steward", "police", "footballer", "referee", "medic", "mascot"], floor: C.players, ...r(-2, -38, 2, -28) },

  // Behind the Main Stand: staff only.
  { id: "kitroom", name: "Kit room", access: "restricted", roles: ["footballer", "catering", "steward", "medic"], floor: 0x3e4a5a, ...r(-56, -61, -47, -50) },
  { id: "medical", name: "Medical room", access: "staff", roles: ["medic", "steward", "police"], floor: 0xb8c4c8, ...r(-47, -61, -40, -50) },
  { id: "backcorr", name: "Back corridor", access: "staff", roles: ["steward", "police", "catering", "cleaner", "medic", "footballer"], floor: C.players, ...r(-56, -50, -40, -38.5) },
  { id: "players", name: "Players' corridor", access: "restricted", roles: ["steward", "police", "footballer", "referee", "medic", "catering", "cleaner"], floor: C.players, ...r(-40, -48, 40, -38) },
  { id: "dress_home", name: "England dressing room", access: "restricted", roles: ["footballer", "medic"], floor: 0x2d3b6e, ...r(-26, -60, -8, -48) },
  { id: "dress_away", name: "Away dressing room", access: "restricted", roles: ["footballer", "medic"], floor: 0x6e2d36, ...r(8, -60, 26, -48) },
  { id: "ref_room", name: "Match officials' room", access: "restricted", roles: ["referee"], floor: 0x2a2a2a, ...r(-5, -58, 5, -48) },
  { id: "kitchen", name: "Kitchen", access: "staff", roles: ["catering", "cleaner", "steward"], floor: C.kitchen, ...r(-40, -60, -28, -48) },
  { id: "security", name: "Security office", access: "restricted", roles: ["steward", "police"], floor: C.security, ...r(28, -60, 40, -48) },
  { id: "loading", name: "Loading bay", access: "staff", roles: ["catering", "cleaner", "steward", "police"], floor: C.loading, ...r(40, -60, 62, -38) },
  { id: "staffway", name: "Staff corridor", access: "staff", roles: ["catering", "cleaner", "steward", "police", "medic"], floor: C.players, ...r(56, -38, 62, 50) },

  // Inside the concourse.
  { id: "bar_s", name: "Concourse bar", access: "ticket", floor: C.bar, ...r(-20, 40, -6, 44) },
  { id: "toilet_s", name: "Gents", access: "ticket", floor: C.toilet, ...r(6, 39, 16, 44) },
  { id: "cubicle_s", name: "Toilet cubicle", access: "ticket", floor: 0x8e9aa0, private: true, ...r(14, 39, 16, 41) },

  // Outside.
  { id: "ticket_office", name: "Ticket office", access: "public", floor: C.ticket, outside: true, ...r(16, 47, 26, 52) },
  { id: "merch", name: "Merchandise stall", access: "public", floor: 0x3f5a73, outside: true, ...r(-26, 47, -16, 52) },
  { id: "pub", name: "The Three Lions", access: "public", floor: C.pub, outside: true, ...r(-62, 62, -34, 80) },
  { id: "pub_toilet", name: "Pub toilets", access: "public", floor: C.toilet, outside: true, ...r(-62, 62, -54, 68) },
  { id: "pub_cubicle", name: "Toilet cubicle", access: "public", floor: 0x8e9aa0, private: true, outside: true, ...r(-62, 62, -59, 65) },
  { id: "pub_yard", name: "Pub yard", access: "public", floor: C.yard, outside: true, ...r(-34, 64, -22, 80) },
  { id: "cabin", name: "Stewards' cabin", access: "staff", roles: ["steward", "police"], floor: C.cabin, outside: true, ...r(76, 50, 88, 58) },
  { id: "hotel_court", name: "Hotel forecourt", access: "public", floor: 0x4a4f55, outside: true, ...r(72, -14, 92, -2) },
  { id: "hotel", name: "Team hotel", access: "staff", roles: ["footballer", "catering", "steward", "police"], floor: 0x5a4a5e, outside: true, ...r(74, -40, 92, -14) },
  { id: "carpark", name: "Car park", access: "public", floor: 0x34373b, outside: true, ...r(26, 62, 60, 82) },
  { id: "charity", name: "Second Hand Rose (charity shop)", access: "public", floor: 0x4a3f38, outside: true, ...r(-18, 62, -4, 72) },
  { id: "surplus", name: "Army & Navy Surplus", access: "public", floor: 0x3d4434, outside: true, ...r(8, 62, 22, 72) },
  { id: "bookies", name: "Cash Kings Pawnbrokers", access: "public", floor: 0x3d3350, outside: true, ...r(28, 62, 44, 72) },
];

const WALL = 0x8a8f96, WALLTOP = 0xb4b9bf, BRICK = 0x7a4a3a, BRICKTOP = 0x9a6a55, CABIN = 0x6f7a62;
const wall = (x0: number, y0: number, x1: number, y1: number, h3 = 3, colour = WALL, top = WALLTOP, gate?: string): Wall =>
  ({ ...r(x0, y0, x1, y1), h3, colour, top, gate });

/** Solid things. Gaps in these lists are doorways. */
const QF_WALLS: Wall[] = [
  // Outer wall, south side, with turnstiles in the middle and a staff door at the east end.
  wall(-57, 44, -9, 45), wall(9, 44, 56, 45),
  wall(-9, 44, -7.5, 45), wall(-4.5, 44, -3, 45), wall(3, 44, 4.5, 45), wall(7.5, 44, 9, 45),
  wall(-7.5, 44, -4.5, 45, 1.2, 0x5a6270, 0x7a8290, "turnstile1"),
  wall(-3, 44, 3, 45, 1.2, 0x5a6270, 0x7a8290, "turnstile2"),
  wall(4.5, 44, 7.5, 45, 1.2, 0x5a6270, 0x7a8290, "turnstile3"),
  wall(55.6, 44, 56, 51), wall(63, 44, 63.4, 51), // the staff corridor runs out to a door at y 50
  wall(56, 50, 58, 51), wall(61, 50, 63.4, 51),
  wall(58, 50, 61, 51, 2.2, 0x50607a, 0x6a7a94, "staffdoor"),
  // West and east outer walls.
  wall(-57, -62, -56, -56), wall(-57, -56, -56, -53, 2.4, 0x50607a, 0x6a7a94, "playersdoor"), wall(-57, -53, -56, 45),
  wall(62, -62, 63, -46), wall(62, -40, 63, 44),
  // The west edge of the map: a palisade fence, with the ring road running on through.
  wall(-70.5, -62, -70, 83.8, 2.2, 0x2f5a3a, 0x3f6a4a), wall(-70.5, 92.2, -70, 96, 2.2, 0x2f5a3a, 0x3f6a4a),
  wall(62, -46, 63, -40, 2.5, 0x606a50, 0x7a846a, "servicegate"),
  // North outer wall.
  wall(-57, -62, 63, -61),
  // Between the concourse and the staff corridor on the east.
  wall(56, -38, 56.5, 44),
  // Back of the Main Stand: the players' area is walled off from the stand and the concourses.
  wall(-56, -38.5, -40, -38), wall(40, -38.5, 56, -38),
  wall(-40, -38.5, -2, -38), wall(2, -38.5, 40, -38),
  wall(-2.4, -38, -2, -28.6, 1.6), wall(2, -38, 2.4, -28.6, 1.6), // tunnel sides
  // West of the corridor: the kit room (players' entrance from the alley) and the medical room,
  // off a back corridor that runs into the players' corridor.
  wall(-56, -61.5, -40, -61), wall(-47.25, -61, -46.75, -55), wall(-47.25, -52, -46.75, -50),
  wall(-56, -50, -53, -49.5), wall(-51, -50, -45, -49.5), wall(-43, -50, -40, -49.5),
  wall(-40.5, -61, -40, -48.5),
  // Rooms behind the corridor (doors face the corridor).
  wall(-40, -48.5, -36, -48), wall(-32, -48.5, -26, -48), // kitchen door at -36..-32
  wall(-26.5, -61, -26, -48), // west wall of the England room
  wall(-26, -48.5, -19, -48), wall(-15, -48.5, -8, -48), // home room door -19..-15
  wall(-8, -61, -7.5, -48), wall(-8, -48.5, -2, -48), wall(2, -48.5, 8, -48), // ref room door -2..2
  wall(5, -61, 5.5, -48), wall(8, -48.5, 15, -48), wall(19, -48.5, 28, -48), // away room door 15..19
  wall(-28, -61, -27.5, -48), wall(26, -61, 26.5, -48), wall(28, -61, 28.5, -48),
  wall(28, -48.5, 32, -48), wall(36, -48.5, 40, -48), // security door 32..36
  wall(32, -48.5, 36, -48, 2.2, 0x464b5c, 0x666b7c, "officedoor"),
  wall(40, -61, 40.5, -48),
  // Back walls of the stands, with gangways through.
  wall(-40, 38, -24, 38.6), wall(-20, 38, -4, 38.6), wall(4, 38, 20, 38.6), wall(24, 38, 40, 38.6),
  wall(-50.6, -27, -50, -6), wall(-50.6, 6, -50, 27),
  wall(50, -27, 50.6, -6), wall(50, 6, 50.6, 27),
  // Concourse bar counter and toilet partitions.
  wall(-20, 41.6, -6, 42.4, 1.1, 0x6b4a33, 0x8a6a50),
  wall(6, 38.6, 6.4, 42), wall(14, 41, 16, 41.3, 2.2), wall(13.8, 38.6, 14, 41, 2.2),
  // Pub.
  wall(-62, 61.5, -34, 62, 3.5, BRICK, BRICKTOP), wall(-62, 80, -48, 80.5, 3.5, BRICK, BRICKTOP), wall(-44, 80, -34, 80.5, 3.5, BRICK, BRICKTOP),
  wall(-62.5, 61.5, -62, 80.5, 3.5, BRICK, BRICKTOP), wall(-34.5, 62, -34, 66, 3.5, BRICK, BRICKTOP), wall(-34.5, 70, -34, 80.5, 3.5, BRICK, BRICKTOP),
  wall(-54, 62, -53.6, 66, 2.4), wall(-59, 65, -54, 65.3, 2.2), wall(-59.2, 62, -59, 65, 2.2),
  wall(-50, 66, -38, 67.2, 1.1, 0x6b4a33, 0x8a6a50), // the bar
  // Ticket office booth and merch stall.
  wall(16, 47, 26, 48, 2.6, 0x4a5a70, 0x6a7a90), wall(-26, 47, -16, 48, 1.4, 0x3f5a73, 0x5f7a93),
  // Charity shop and army surplus: shopfronts on the road side, shopkeepers behind counters at the back.
  wall(-18.5, 61.5, -3.5, 62, 3, 0x6a5a4a, 0x8a7a6a),
  wall(-18.5, 62, -18, 72.5, 3, 0x6a5a4a, 0x8a7a6a), wall(-4, 62, -3.5, 72.5, 3, 0x6a5a4a, 0x8a7a6a),
  wall(-18.5, 72, -14.6, 72.5, 3, 0x6a5a4a, 0x8a7a6a), wall(-10.6, 72, -3.5, 72.5, 3, 0x6a5a4a, 0x8a7a6a),
  wall(7.5, 61.5, 22.5, 62, 3, 0x4d5640, 0x6d7660),
  wall(7.5, 62, 8, 72.5, 3, 0x4d5640, 0x6d7660), wall(22, 62, 22.5, 72.5, 3, 0x4d5640, 0x6d7660),
  wall(7.5, 72, 13, 72.5, 3, 0x4d5640, 0x6d7660), wall(17, 72, 22.5, 72.5, 3, 0x4d5640, 0x6d7660),
  // The team hotel: doors onto the forecourt.
  wall(74, -40.5, 92, -40, 6, 0x6a5a70, 0x8a7a90), wall(73.5, -40.5, 74, -14, 6, 0x6a5a70, 0x8a7a90),
  wall(74, -14.5, 80, -14, 6, 0x6a5a70, 0x8a7a90), wall(84, -14.5, 92, -14, 6, 0x6a5a70, 0x8a7a90),
  // Bookmaker's, door at the bottom; counter across the back. And a betting kiosk on the concourse.
  wall(27.5, 61.5, 44.5, 62, 3.2, 0x4a3d60, 0x6a5d80), wall(27.5, 62, 28, 72.5, 3.2, 0x4a3d60, 0x6a5d80), wall(44, 62, 44.5, 72.5, 3.2, 0x4a3d60, 0x6a5d80),
  wall(27.5, 72, 34, 72.5, 3.2, 0x4a3d60, 0x6a5d80), wall(38, 72, 44.5, 72.5, 3.2, 0x4a3d60, 0x6a5d80),
  wall(26, 41.6, 34, 42.4, 1.1, 0x4a3d60, 0x6a5d80),
  // Stewards' cabin, door on the west side facing the service road.
  wall(76, 50, 88, 50.5, 2.8, CABIN, 0x8a9a7a), wall(76, 57.5, 88, 58, 2.8, CABIN, 0x8a9a7a),
  wall(76, 50, 76.5, 52, 2.8, CABIN, 0x8a9a7a), wall(76, 55, 76.5, 58, 2.8, CABIN, 0x8a9a7a), wall(87.5, 50, 88, 58, 2.8, CABIN, 0x8a9a7a),
];

/** Street furniture you bump into: queue barriers, bins, bollards, lamp posts, the vans. */
const prop = (cx: number, cy: number, w: number, h: number, h3 = 1): Wall => ({ x: cx - w / 2, y: cy - h, w, h, h3, colour: 0x555555, top: 0x777777, prop: true });
const QF_PROPS: Wall[] = [
  ...[-9, -3, 3, 9].map((x) => prop(x, 50.6, 2.4, 0.3)),
  ...[-52, -39, -26, -13, 13, 26, 39, 52].map((x) => prop(x, 60.7, 0.4, 0.4)),
  ...[-84, -60, -36, -12, 12, 36, 60, 84].map((x) => prop(x, 83.7, 0.35, 0.35, 3)),
  prop(-2, 73.5, 0.9, 0.7), prop(23.6, 73.5, 0.9, 0.7), prop(-33, 81.7, 0.9, 0.7), prop(45.6, 73.5, 0.9, 0.7),
  prop(46, 53, 6.2, 2.2, 2.6), prop(32, 55.6, 5.6, 2.2, 2.4),
  prop(-34, 50, 2.2, 0.9), prop(-30, 83.4, 1.2, 1.1, 2.5),
];

/** Furniture and street dressing: a picture (by name) standing with its base on y, and, if `solid`,
 *  a footprint you bump into. `room` says which building it belongs to. */
export interface Furniture { key: string; x: number; y: number; w: number; d: number; solid: boolean; room?: string; h3?: number }
const f = (key: string, x: number, y: number, w: number, d: number, solid: boolean, room?: string, h3 = 1): Furniture => ({ key, x, y, w, d, solid, room, h3 });
export const QF_FURNITURE: Furniture[] = [
  // The Three Lions: tables, the pool table, a fruit machine, the telly, pumps on the bar.
  f("pubtable", -58, 73.5, 1.5, 0.8, true, "pub"), f("pubtable", -58, 78, 1.5, 0.8, true, "pub"), f("pubtable", -53.5, 78.6, 1.5, 0.8, true, "pub"),
  f("pooltable", -51, 72.6, 2.6, 1.4, true, "pub"), f("fruitmachine", -36, 64.4, 1, 0.6, true, "pub", 2),
  f("toiletsign", -52.6, 66.6, 1, 0.2, false, "pub"),
  f("pubtv", -36.2, 75.2, 1.8, 0.5, false, "pub"), f("pumps", -47.5, 67.25, 2.2, 0.3, false, "pub"), f("pumps", -40.5, 67.25, 2.2, 0.3, false, "pub"),
  // The shops: a counter at the back with the shopkeeper behind it (you're served across it), and a
  // shop floor in front worth browsing. Second Hand Rose: rails, a mannequin in somebody's nan's
  // frock, a table of tat, a bookcase of VHS. Army surplus: shelving, camo on a rail, ammo tins, a
  // dummy in a gas mask. The bookie's: two windows behind glass, slip stands, screens by the door.
  f("shopcounter", -11, 65.4, 2.8, 0.9, true, "charity"),
  f("clothesrail", -16.6, 67.4, 1.6, 0.4, true, "charity"), f("clothesrail", -16.6, 70.4, 1.6, 0.4, true, "charity"), f("clothesrail", -5.4, 67.4, 1.6, 0.4, true, "charity"),
  f("bookcase", -16.8, 63.6, 1.4, 0.5, true, "charity", 2), f("bookcase", -4.9, 63.6, 1.4, 0.5, true, "charity", 2), f("mannequin", -7.6, 64.4, 0.5, 0.4, true, "charity", 2),
  f("brictable", -6.2, 70.6, 1.8, 0.7, true, "charity"),
  f("armycounter", 15, 65.4, 2.8, 0.9, true, "surplus"),
  f("shelves", 9.4, 64.4, 1.5, 0.6, true, "surplus"), f("shelves", 20.6, 64.4, 1.5, 0.6, true, "surplus"), f("shelves", 20.6, 71.6, 1.5, 0.6, true, "surplus"),
  f("camorack", 9.6, 68.2, 1.7, 0.5, true, "surplus"), f("ammoboxes", 20.4, 68.2, 1.2, 0.7, true, "surplus"), f("camomannequin", 10.2, 71.4, 0.5, 0.4, true, "surplus", 2), f("ammoboxes", 18.4, 71.5, 1.2, 0.7, true, "surplus"),
  // Lionel's: a pawnbroker's now. The jewellery counter, tellies stacked up, guitars, bikes by the door.
  f("pawncounter", 36, 65.6, 3.4, 0.9, true, "bookies"),
  f("tvstack", 30.2, 64.4, 1.4, 0.8, true, "bookies", 2), f("guitarrack", 42, 64.4, 1.7, 0.6, true, "bookies", 2),
  f("tvstack", 42.6, 68.2, 1.4, 0.8, true, "bookies", 2), f("guitarrack", 29.6, 68.2, 1.7, 0.6, true, "bookies", 2),
  f("bikerack", 30.8, 71.2, 2.8, 0.6, true, "bookies"),
  // The team hotel lobby: reception, sofas, palms, the kit bags waiting for the coach.
  f("sofa", 77.6, -31, 2.4, 0.9, true, "hotel"), f("sofa", 77.6, -22.6, 2.4, 0.9, true, "hotel"),
  f("bigplant", 74.9, -38.6, 0.8, 0.6, true, "hotel", 2), f("bigplant", 91, -38.6, 0.8, 0.6, true, "hotel", 2), f("bigplant", 79, -15.2, 0.8, 0.6, true, "hotel", 2),
  f("luggage", 86.5, -17.4, 1.2, 0.7, true, "hotel"), f("luggage", 89.6, -17.4, 1.2, 0.7, true, "hotel"), f("bigplant", 85, -15.2, 0.8, 0.6, true, "hotel", 2),
  // Behind the scenes: the kitchen, dressing rooms, the security office, the stewards' cabin, hotel reception.
  f("kitchen", -37.5, -58.4, 2.8, 1.2, true, "kitchen", 2), f("kitchen", -31, -58.4, 2.8, 1.2, true, "kitchen", 2),
  f("lockers", -21, -59.6, 2.6, 0.8, true, "dress_home", 2), f("lockers", -13, -59.6, 2.6, 0.8, true, "dress_home", 2), f("kitbench", -17, -51.2, 2.8, 0.6, false, "dress_home"),
  f("lockers", 13, -59.6, 2.6, 0.8, true, "dress_away", 2), f("lockers", 21, -59.6, 2.6, 0.8, true, "dress_away", 2), f("kitbench", 17, -51.2, 2.8, 0.6, false, "dress_away"),
  f("desk", 33, -56.4, 1.9, 0.6, false, "security"), f("desk", 83, 51.6, 1.9, 0.6, false, "cabin"), f("reception", 87.8, -27, 3.6, 1, true, "hotel"),
  // Pitchside: the dugouts either side of the tunnel, TV cameras, the groundsman's cart.
  f("dugout", -7.5, -26.2, 4.2, 1.2, true), f("dugout", 7.5, -26.2, 4.2, 1.2, true),
  f("tvcamera", -18, 25.6, 0.8, 0.5, false), f("tvcamera", 18, 25.6, 0.8, 0.5, false), f("tvcamera", 37.8, -6, 0.8, 0.5, false),
  f("cart", -38.5, -26.5, 2.6, 1.3, true),
  // The alley: the groundsman's shed, a skip; the kit room and medical room fitted out.
  f("shed", -66, 12, 3, 2.4, true), f("skip", -65.5, -18, 3.4, 1.8, true), f("parkedcar", -65.5, -34, 4.6, 1.8, true),
  f("hamper", -50, -51.2, 1.6, 0.9, true, "kitroom"), f("clothesrail", -54.5, -59.6, 1.6, 0.6, true, "kitroom"), f("shelves", -49, -60.2, 1.5, 0.6, true, "kitroom"),
  f("medbed", -43.5, -57.8, 2.6, 1.1, true, "medical"),
  f("grate", -24, -58.4, 1, 1, false, "dress_home"), f("hatch", -60.5, 78.4, 1.3, 1, false, "pub"),
  // Inside the ground: food kiosks and condiments on the concourses, tellies on poles, the gents.
  f("foodkiosk", -36, 39.9, 3.8, 1.3, true, undefined, 2.4), f("foodkiosk", 44, 39.9, 3.8, 1.3, true, undefined, 2.4),
  f("foodkiosk", -45, 31.5, 3.8, 1.3, true, undefined, 2.4), f("foodkiosk", 45, 31.5, 3.8, 1.3, true, undefined, 2.4),
  f("condiments", -32.8, 40.6, 0.6, 0.4, true), f("condiments", 40.8, 40.6, 0.6, 0.4, true),
  f("tvpost", -26, 39.3, 0.5, 0.4, true, undefined, 2.5), f("tvpost", 22, 39.3, 0.5, 0.4, true, undefined, 2.5),
  f("tvpost", -53, -10, 0.5, 0.4, true, undefined, 2.5), f("tvpost", 53, 10, 0.5, 0.4, true, undefined, 2.5),
  f("condiments", -54.6, 14, 0.6, 0.4, true), f("condiments", 54.6, -14, 0.6, 0.4, true),
  // Ladders up onto the roofs (roofs.ts), and brick piles (missiles.ts).
  f("ladder_pub", -38, 80.9, 1, 0.3, false, undefined, 4), f("ladder_shop", -6, 72.9, 1, 0.3, false, undefined, 3.5), f("ladder_shop", 20.2, 72.9, 1, 0.3, false, undefined, 3.5), f("ladder_hotel", 76.2, -13.6, 1, 0.3, false, undefined, 6),
  f("bricks", 50, 48.6, 1.8, 0.8, false), f("bricks", -66, 30.4, 1.8, 0.8, false), f("bricks", 52, 79.4, 1.8, 0.8, false), f("bricks", -24.5, 76.4, 1.8, 0.8, false),
  // Concourse life: a programme seller, bins, litter, a sandwich board.
  f("programmes", 33, 39.9, 1.8, 0.8, true), f("bin", -28.6, 39.1, 0.6, 0.6, true), f("bin", 27.2, 39.1, 0.6, 0.6, true), f("bin", -53.8, 20, 0.6, 0.6, true), f("bin", 53.8, -20, 0.6, 0.6, true),
  f("litter", -10, 43.2, 1, 0.6, false), f("chippaper", 17.5, 42.7, 0.8, 0.5, false), f("litter", -44, 42.5, 1, 0.6, false), f("chippaper", -53, -18, 0.8, 0.5, false),
  f("aboard", 37.5, 42.8, 0.8, 0.4, true),
  f("sinks", 7, 39.6, 0.7, 0.4, false, "toilet_s"), f("sinks", 8.1, 39.6, 0.7, 0.4, false, "toilet_s"), f("sinks", 9.2, 39.6, 0.7, 0.4, false, "toilet_s"),
  f("urinal", 11.6, 39.7, 3.2, 0.6, true, "toilet_s"),
  // The dressing rooms: shirts on pegs, the physio's table, an ice bath, the tactics board, boots,
  // and the showers over the drain grate.
  f("kitpegs", -17, -59.3, 3.8, 0.4, false, "dress_home"), f("massage", -11, -53, 2.8, 1, true, "dress_home"), f("icebath", -23.4, -54.2, 1.8, 1.4, true, "dress_home"),
  f("tactics", -24.2, -50.2, 2, 0.6, true, "dress_home", 2), f("boots", -15, -50.4, 1, 0.5, false, "dress_home"), f("boots", -19.5, -50.4, 1, 0.5, false, "dress_home"),
  f("showers", -24.3, -59.4, 3.3, 0.3, false, "dress_home"),
  f("kitpegs", 17, -59.3, 3.8, 0.4, false, "dress_away"), f("massage", 11, -53, 2.8, 1, true, "dress_away"), f("icebath", 23.4, -54.2, 1.8, 1.4, true, "dress_away"),
  f("tactics", 24.2, -50.2, 2, 0.6, true, "dress_away", 2), f("boots", 15, -50.4, 1, 0.5, false, "dress_away"),
  f("showers", 24.3, -59.4, 3.3, 0.3, false, "dress_away"),
  // The approach and the car park: a scaffold on the corner, a pie stand, the TV truck, parked cars, the horsebox.
  f("scaffold", 47.5, 46.4, 3.6, 1.2, true), f("ladder_stand", -36, 45.4, 1, 0.3, false, undefined, 5), f("kitbag", 57.8, 73.2, 1.4, 0.8, false), f("piestand", -40, 54.5, 3.2, 1.6, true),
  f("obtruck", 52.5, 65.2, 6.8, 2.6, true), f("horsebox", 40, 81, 6.2, 2.4, true),
  f("parkedcar", 47.6, 77.6, 4.6, 1.8, true), f("parkedcar", 36.5, 77.6, 4.6, 1.8, true), f("parkedcar", 57.2, 77.6, 4.6, 1.8, true),
  // The street: trees in grates along the approach, a statue, bin bags and pavement boards.
  ...[-45.5, -32.5, -19.5, 19.5, 32.5, 45.5].map((x) => f("tree", x, 59.4, 0.5, 0.5, true, undefined, 3)),
  f("statue", -44, 53.2, 1.3, 1.0, true, undefined, 3),
  f("binbags", -23, 78.8, 1.3, 0.6, false), f("binbags", 6, 72.9, 1.3, 0.6, false), f("binbags", 50, -59.2, 1.3, 0.6, false),
  f("aboard", -50.5, 81.6, 0.8, 0.4, false), f("aboard", -7.5, 73.4, 0.8, 0.4, false),
];
const furnitureWalls = (list: Furniture[]): Wall[] => list.filter((q) => q.solid).map((q) => ({ ...prop(q.x, q.y, q.w, q.d, q.h3 ?? 1) }));

export const KICKOFF_AT = 330; // seconds after arrival

const QF_SPOTS = {
  arrival: { x: 6, y: 58 },
  homeRoom: { x: -17, y: -54 },
  awayRoom: { x: 17, y: -54 },
  refRoom: { x: 0, y: -54 },
  tunnelTop: { x: 0, y: -28.5 },
  tunnelBottom: { x: 0, y: -40 },
  ejectPoint: { x: 0, y: 52 },
  holding: { x: 31, y: -57 },
  locker: { x: 38.5, y: -58.5 },
  turnstiles: [{ x: -6, y: 44.5 }, { x: 0, y: 44.5 }, { x: 6, y: 44.5 }],
  staffDoor: { x: 59.5, y: 50.5 },
  serviceGate: { x: 62.5, y: -43 },
  pubBar: { x: -44, y: 68.4 },
  pubBarman: { x: -44, y: 64.6 },
  pubTv: { x: -40, y: 76 },
  barSman: { x: -13, y: 43.2 },
  ticketSeller: { x: 21, y: 46.2 },
  merchSeller: { x: -21, y: 46.2 },
  doorPost: { x: 59.5, y: 48.6 },
  gatePost: { x: 60, y: -36.6 },
  gateInspect: { x: 71.2, y: -44.8 },
  corridorPost: { x: 0, y: -43 },
  chiefDesk: { x: 34, y: -55 },
  kitchenSpot: { x: -34, y: -54 },
  pubYard: { x: -28, y: 72 },
  loadingBay: { x: 50, y: -44 },
  barS: { x: -13, y: 40.8 },
  ticketWindow: { x: 21, y: 49 },
  merchCounter: { x: -21, y: 49 },
  cabinHook: { x: 86, y: 54 },
  bookie: { x: 36, y: 63.3 },
  charity: { x: -11, y: 63.7 },
  surplus: { x: 15, y: 63.7 },
  bookieCounter: { x: 36, y: 66.6 },
  kiosk: { x: 30, y: 43.2 },
  kioskCounter: { x: 30, y: 40.8 },
  cabinDoor: { x: 75, y: 53.5 },
  policeVan: { x: 32, y: 54.5 },
  hotelLobby: { x: 83, y: -24 },
  dogPost: { x: -50.5, y: 82.4 },
  busPark: { x: 83, y: -7 },
  busBay: { x: 46, y: -40.8 },
  /** Break glass, press here. */
  cellar: { x: -60.5, y: 78 },
  grate: { x: -24, y: -58.4 },
  scaffold: { x: 47.5, y: 47.3 },
  roofDrop: { x: 3.4, y: -40.6 },
  medBed: { x: -43.5, y: -57 },
  kitRoom: { x: -51.5, y: -56 },
  playersDoor: { x: -59, y: -54.5 },
  tout: { x: -12, y: 57 },
  reporter: { x: 8, y: 56.2 },
  cameraman: { x: 8, y: 59.6 },
  shed: { x: -63.2, y: 10.5 },
  ladder: { x: -36, y: 45.8 },
  para: { x: 56, y: 71.6 },
  kitbag: { x: 57.8, y: 72.6 },
  mascotSmoke: { x: -63, y: -40 },
  hamperOut: { x: -60.5, y: -56.2 },
  bike1: { x: -58, y: -42 },
  bike2: { x: 75, y: 60 },
  pitchSpot: { x: -14, y: 26.4 },
  alarmPoints: [{ x: -30, y: 43.6 }, { x: 36, y: 43.6 }, { x: -55.6, y: -12 }, { x: 55.6, y: 18 }, { x: -30, y: -47.6 }],
};

/** Turnstile gate ids, west to east. */
export const TURNSTILES = ["turnstile1", "turnstile2", "turnstile3"];

// ---------------------------------------------------------------------------
// Venues. Everything above is the quarter-final ground. The semi-final ground is
// built from it, mirrored and changed, with its own routines and security.

export type Spots = typeof QF_SPOTS;
type P = { x: number; y: number };

export interface Venue {
  id: "qf" | "sf" | "final";
  round: string;
  /** Key into TEAMS for the opposition. */
  opp: string;
  ground: string;
  areas: Area[];
  walls: Wall[];
  spots: Spots;
  /** Words painted on the ground: text, x, y, size. */
  labels: [string, number, number, number?][];
  /** The delivery vehicle's run: there and back; the gate it stops at; doors the crew carry crates to. */
  delivery: { name: string; route: number[]; gateStop: P; loadDoor: P; unloadDoor: P; gateInspect: number };
  /** The team bus: hotel forecourt to the loading bay. */
  busRoute: number[];
  /** Walks for the people with rounds. */
  patrolLoop: P[]; policeSpots: P[]; cleanerSpots: P[]; corridorSpots: P[];
  /** Where you can climb a wall, if anywhere. */
  climbPoints: P[];
  features: {
    /** Chance a pat-down finds something in a pocket. */
    patDown: number;
    /** Metal detectors find anything metal, every time. */
    metalDetectors: boolean;
    /** Cameras at the turnstiles recognise barred faces unless half covered. */
    faceCameras: boolean;
    /** The staff door guard nips out for a smoke and props the door open. */
    doorSmokes: boolean;
    /** The staff door needs a pass as well as the right clothes. */
    staffPass: boolean;
    /** The pub is an open-air fan zone with a big screen. */
    fanZone: boolean;
    /** After everything that's happened: a penis detector at the turnstiles. */
    penisDetector?: boolean;
  };
  /** Is a point inside the ground (past the turnstiles)? */
  inside(x: number, y: number): boolean;
  furniture: Furniture[];
}

const mirrorRect = <T extends { x: number; w: number }>(r: T): T => ({ ...r, x: -(r.x + r.w) });
const mirrorP = (p: P): P => ({ x: -p.x, y: p.y });
const mirrorRoute = (r: number[]) => r.map((v, i) => (i % 2 === 0 ? -v : v));
function mirrorSpots(sp: Spots): Spots {
  const out: any = {};
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v.map(mirrorP) : mirrorP(v as P);
  return out;
}

const QF_LABELS: Venue["labels"] = [
  ["THE THREE LIONS", -48, 72, 13], ["TICKETS", 21, 50.6], ["MERCHANDISE", -21, 50.6], ["TURNSTILES", 0, 46.2],
  ["STAFF ENTRANCE", 59.5, 52.4], ["STEWARDS", 82, 54], ["SERVICE GATE", 66, -48], ["LOADING BAY", 50, -54],
  ["SECURITY", 34, -51], ["ENGLAND", -17, -50], ["AWAY", 17, -50], ["OFFICIALS", 0, -50.5], ["KITCHEN", -34, -50],
  ["SECOND HAND ROSE", -11, 64.5], ["ARMY & NAVY", 15, 64.5], ["BOOKMAKER", 36, 69.5], ["BETS", 30, 40.4],
  ["BAR", -13, 40.6], ["GENTS", 10, 39.6], ["CAR PARK", 43, 72], ["TOILETS", -58, 67], ["TEAM HOTEL", 83, -30, 12],
];

const VENUES_QF: Venue = {
    id: "qf", round: "quarter-final", opp: "POR", ground: "Wembley Park",
    areas: QF_AREAS, walls: [...QF_WALLS, ...QF_PROPS, ...furnitureWalls(QF_FURNITURE)], spots: QF_SPOTS, labels: QF_LABELS, furniture: QF_FURNITURE,
    delivery: { name: "beer lorry", route: [-28, 74, -28, 88, 67, 88, 67, -43, 56, -43, 50, -44], gateStop: { x: 67, y: -43 }, loadDoor: { x: -34.8, y: 68 }, unloadDoor: { x: 46, y: -48.6 }, gateInspect: 0.25 },
    busRoute: [83, -7, 67, -7, 67, -41, 56, -41, 46, -40.8],
    patrolLoop: [{ x: -45, y: 41 }, { x: 45, y: 41 }, { x: 53, y: 0 }, { x: 45, y: 41 }, { x: -45, y: 41 }, { x: -53, y: 0 }],
    policeSpots: [{ x: -30, y: 58 }, { x: 10, y: 55 }, { x: -46, y: 82 }, { x: 30, y: 57 }],
    cleanerSpots: [{ x: -30, y: 40 }, { x: 30, y: 40 }, { x: 10, y: 41 }, { x: 53, y: 20 }, { x: -53, y: -20 }],
    corridorSpots: [{ x: 0, y: -43 }, { x: -17, y: -45 }, { x: 0, y: -43 }, { x: 17, y: -45 }],
    climbPoints: [],
    features: { patDown: 0.5, metalDetectors: false, faceCameras: false, doorSmokes: true, staffPass: false, fanZone: false },
    inside: (x, y) => y < 44 && y > -61 && x > -56 && x < 63,
};
export const VENUES: Record<Venue["id"], Venue> = {
  qf: VENUES_QF,
  sf: buildSemiFinal(),
  final: buildFinal(),
};

/** The final: the national stadium, built like the quarter-final ground, and every security
 *  measure anyone could think of, including one nobody should have. */
function buildFinal(): Venue {
  const qf = VENUES_QF;
  return {
    ...qf, id: "final", round: "final", opp: "ARG", ground: "National Stadium",
    // A detector on a pedestal beside each turnstile.
    furniture: [...qf.furniture, ...[-6, 0, 6].map((x) => f("detector", x + 1.5, 45.4, 0.5, 0.4, false))],
    features: { patDown: 0.9, metalDetectors: true, faceCameras: true, doorSmokes: false, staffPass: true, fanZone: false, penisDetector: true },
  };
}

function buildSemiFinal(): Venue {
  // The same kind of bowl, the other way round: the fan zone, the car park, the
  // stewards' cabin and the service road are all on the opposite side.
  let areas = QF_AREAS.map(mirrorRect);
  // No pub furniture in the fan zone.
  const furniture = QF_FURNITURE.filter((q) => q.room !== "pub").map((q) => ({ ...q, x: -q.x }));
  let walls = [...QF_WALLS, ...QF_PROPS].map(mirrorRect).concat(furnitureWalls(furniture));
  const spots = mirrorSpots(QF_SPOTS);
  // The pub is an open-air fan zone: its walls come down, the bar stays.
  const pub = QF_AREAS.find((a) => a.id === "pub")!;
  const inPub = (w: Wall) => { const m = mirrorRect(pub); return w.x >= m.x - 0.6 && w.x + w.w <= m.x + m.w + 0.6 && w.y >= m.y - 0.6 && w.y + w.h <= m.y + m.h + 0.6 && w.h3 > 2; };
  walls = walls.filter((w) => !inPub(w));
  areas = areas.map((a) => (a.id === "pub" ? { ...a, name: "Fan Zone", floor: 0x3c5a3a } : a.id === "pub_toilet" ? { ...a, name: "Portable toilets" } : a));
  // A loose panel in the outer wall by the car park.
  const climb = { x: 44, y: 44.5 };
  const labels: Venue["labels"] = QF_LABELS.map(([t, x, y, sz]) => [t === "THE THREE LIONS" ? "FAN ZONE" : t, -x, y, sz]);
  labels.push(["BIG SCREEN", 48, 63.4, 11], ["LOOSE PANEL", climb.x, 46.4, 9]);
  return {
    id: "sf", round: "semi-final", opp: "BRA", ground: "Estadio del Sol",
    areas, walls, spots, labels, furniture,
    busRoute: mirrorRoute([83, -7, 67, -7, 67, -41, 56, -41, 46, -40.8]),
    delivery: { name: "catering van", route: mirrorRoute([-28, 74, -28, 88, 67, 88, 67, -43, 56, -43, 50, -44]), gateStop: { x: -67, y: -43 }, loadDoor: { x: 34.8, y: 68 }, unloadDoor: { x: -46, y: -48.6 }, gateInspect: 0.55 },
    patrolLoop: [{ x: 45, y: 41 }, { x: -45, y: 41 }, { x: -53, y: 0 }, { x: -45, y: 41 }, { x: 45, y: 41 }, { x: 53, y: 0 }],
    policeSpots: [{ x: 30, y: 58 }, { x: -10, y: 55 }, { x: 46, y: 82 }, { x: -30, y: 57 }, { x: 0, y: 49 }],
    cleanerSpots: [{ x: 30, y: 40 }, { x: -30, y: 40 }, { x: -10, y: 41 }, { x: -53, y: 20 }, { x: 53, y: -20 }],
    corridorSpots: [{ x: 0, y: -43 }, { x: 17, y: -45 }, { x: 0, y: -43 }, { x: -17, y: -45 }],
    climbPoints: [climb],
    features: { patDown: 0.75, metalDetectors: true, faceCameras: true, doorSmokes: false, staffPass: true, fanZone: true },
    inside: (x, y) => y < 44 && y > -61 && x < 56 && x > -63,
  };
}

/** The current venue. These bindings change when the venue does. */
export let VENUE: Venue = VENUES.qf;
export let AREAS: Area[] = VENUE.areas;
export let WALLS: Wall[] = VENUE.walls;
export let SPOTS: Spots = VENUE.spots;

/** Walls as they stand now: WALLS with any holes knocked in them. */
export let SOLID: Wall[] = WALLS;
/** Changes whenever SOLID does, so caches built from it know to rebuild. */
export let solidKey = "qf";

export function setVenue(id: Venue["id"]): void {
  VENUE = VENUES[id];
  AREAS = VENUE.areas; WALLS = VENUE.walls; SPOTS = VENUE.spots;
  SOLID = WALLS; solidKey = id;
}

/** Can a bus go through this? Gates give way anyway; low walls get driven over; the hotel is built to last. */
export const breakable = (wl: Wall): boolean => !wl.gate && wl.h3 >= 2.5 && wl.h3 <= 4.5;

/** Bring SOLID up to date with the holes in the saved state. Cheap when nothing has changed. */
export function setBreaches(holes: { x: number; y: number; r: number }[]): void {
  const key = VENUE.id + holes.map((h) => `${h.x.toFixed(1)},${h.y.toFixed(1)}`).join(";");
  if (key === solidKey) return;
  solidKey = key;
  let out = WALLS;
  for (const h of holes) {
    const next: Wall[] = [];
    for (const wl of out) {
      const near = h.x > wl.x - h.r && h.x < wl.x + wl.w + h.r && h.y > wl.y - h.r && h.y < wl.y + wl.h + h.r;
      if (!near || !breakable(wl)) { next.push(wl); continue; }
      // Cut the hole out along the wall's length.
      if (wl.w >= wl.h) {
        const a = h.x - h.r, b = h.x + h.r;
        if (a > wl.x + 0.2) next.push({ ...wl, w: a - wl.x });
        if (b < wl.x + wl.w - 0.2) next.push({ ...wl, x: b, w: wl.x + wl.w - b });
      } else {
        const a = h.y - h.r, b = h.y + h.r;
        if (a > wl.y + 0.2) next.push({ ...wl, h: a - wl.y });
        if (b < wl.y + wl.h - 0.2) next.push({ ...wl, y: b, h: wl.y + wl.h - b });
      }
    }
    out = next;
  }
  SOLID = out;
}

export const areaAt = (x: number, y: number): Area => {
  for (let i = AREAS.length - 1; i >= 0; i--) {
    const a = AREAS[i];
    if (x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h) return a;
  }
  return AREAS[0];
};
export const areaById = (id: string): Area => AREAS.find((a) => a.id === id)!;
