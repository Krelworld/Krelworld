// The stadium and its surroundings. Static data: never saved, never changes.
// Metres. The centre spot is (0, 0); y grows towards the south (down the screen).
import type { Access, Role } from "../core/types";

export interface Rect { x: number; y: number; w: number; h: number }
export interface Wall extends Rect { h3: number; colour: number; top: number; /** A gate that can be opened for someone. */ gate?: string }
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
export const AREAS: Area[] = [
  { id: "street", name: "Outside the ground", access: "public", floor: C.street, outside: true, ...r(-92, -62, 92, 96) },
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
  { id: "verge", name: "Pitchside", access: "pitch", roles: ["steward", "police", "medic", "footballer", "referee", "broadcaster"], floor: C.verge, pitch: true, ...r(-41, -28, 41, 28) },
  { id: "pitch", name: "The pitch", access: "pitch", roles: ["footballer", "referee"], floor: C.grass, pitch: true, ...r(-36, -23, 36, 23) },
  { id: "tunnel", name: "Players' tunnel", access: "restricted", roles: ["steward", "police", "footballer", "referee", "medic"], floor: C.players, ...r(-2, -38, 2, -28) },

  // Behind the Main Stand: staff only.
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
  { id: "carpark", name: "Car park", access: "public", floor: 0x34373b, outside: true, ...r(26, 62, 60, 82) },
  { id: "bookies", name: "Lucky Lionel's Bookmakers", access: "public", floor: 0x3d3350, outside: true, ...r(28, 62, 44, 72) },
];

const WALL = 0x8a8f96, WALLTOP = 0xb4b9bf, BRICK = 0x7a4a3a, BRICKTOP = 0x9a6a55, CABIN = 0x6f7a62;
const wall = (x0: number, y0: number, x1: number, y1: number, h3 = 3, colour = WALL, top = WALLTOP, gate?: string): Wall =>
  ({ ...r(x0, y0, x1, y1), h3, colour, top, gate });

/** Solid things. Gaps in these lists are doorways. */
export const WALLS: Wall[] = [
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
  wall(-57, -62, -56, 45), wall(62, -62, 63, -46), wall(62, -40, 63, 44),
  wall(62, -46, 63, -40, 2.5, 0x606a50, 0x7a846a, "servicegate"),
  // North outer wall.
  wall(-57, -62, 63, -61),
  // Between the concourse and the staff corridor on the east.
  wall(56, -38, 56.5, 44),
  // Back of the Main Stand: the players' area is walled off from the stand and the concourses.
  wall(-56, -38.5, -40, -38), wall(40, -38.5, 56, -38),
  wall(-40, -38.5, -2, -38), wall(2, -38.5, 40, -38),
  wall(-2.4, -38, -2, -28.6, 1.6), wall(2, -38, 2.4, -28.6, 1.6), // tunnel sides
  wall(-56, -61, -40, -38.5, 4), // solid block west of the corridor
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
  // Bookmaker's, door at the bottom; counter across the back. And a betting kiosk on the concourse.
  wall(27.5, 61.5, 44.5, 62, 3.2, 0x4a3d60, 0x6a5d80), wall(27.5, 62, 28, 72.5, 3.2, 0x4a3d60, 0x6a5d80), wall(44, 62, 44.5, 72.5, 3.2, 0x4a3d60, 0x6a5d80),
  wall(27.5, 72, 34, 72.5, 3.2, 0x4a3d60, 0x6a5d80), wall(38, 72, 44.5, 72.5, 3.2, 0x4a3d60, 0x6a5d80),
  wall(30, 64.6, 42, 65.4, 1.1, 0x5a4a30, 0x7a6a50),
  wall(26, 41.6, 34, 42.4, 1.1, 0x4a3d60, 0x6a5d80),
  // Stewards' cabin, door on the west side facing the service road.
  wall(76, 50, 88, 50.5, 2.8, CABIN, 0x8a9a7a), wall(76, 57.5, 88, 58, 2.8, CABIN, 0x8a9a7a),
  wall(76, 50, 76.5, 52, 2.8, CABIN, 0x8a9a7a), wall(76, 55, 76.5, 58, 2.8, CABIN, 0x8a9a7a), wall(87.5, 50, 88, 58, 2.8, CABIN, 0x8a9a7a),
];

export const KICKOFF_AT = 330; // seconds after arrival

export const SPOTS = {
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
  gatePost: { x: 59.5, y: -39.2 },
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
  bookieCounter: { x: 36, y: 66.6 },
  kiosk: { x: 30, y: 43.2 },
  kioskCounter: { x: 30, y: 40.8 },
  cabinDoor: { x: 75, y: 53.5 },
};

/** Turnstile gate ids, west to east. */
export const TURNSTILES = ["turnstile1", "turnstile2", "turnstile3"];

export const areaAt = (x: number, y: number): Area => {
  for (let i = AREAS.length - 1; i >= 0; i--) {
    const a = AREAS[i];
    if (x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h) return a;
  }
  return AREAS[0];
};
export const areaById = (id: string): Area => AREAS.find((a) => a.id === id)!;
