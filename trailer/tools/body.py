# KRELWORLD advert trailer: the cut (exec'd by ed.py). Times are seconds; clip windows are original capture frames.
M = T + "music/"
S1, MB, MC = M + "score_1.mp3", M + "mB.mp3", M + "mC.mp3"
def have(c): return os.path.exists(T + f"clips/{c}.frames.txt")
HUD = (60, 70, 840, 472)        # drops the HUD corners (god-mode HP, hotbar) but keeps the action
SET = (91, 45, 764, 430)        # KrelTV: the whole telly
SCR = (200, 92, 560, 315)       # KrelTV: the screen, subtitles in
def near(cx, cy, w=560):
    h = w * 9 / 16; return (cx - w / 2, cy - h / 2, w, h)
def todo(label, secs=2.0):      # rough cut only: a slate for footage still being captured
    text(label, secs, size=64, color=(255, 210, 63), bg=(20, 10, 30))

GS = GAME + "audio/sfx/"
def gs(name, at, g=0.5, **kw): ev("sfx", GS + name + ".mp3", at, g, **kw)
_rnd = random.Random(7)
RATE = {"kreddler": 0.085, "gatling": 0.075, "bfk": 0.42, "disco": 0.3, "flamer": 0.16}
def combat(t, d, gun="kreddler", gore=True, g=0.32):
    """a bed of the game's own gunfire, hits and gore under a combat shot (the capture is silent)"""
    r = RATE.get(gun, 0.12); x = t + 0.02
    while x < t + d - 0.05:
        gs("gun_" + gun, x, g * _rnd.uniform(0.75, 1.0)); x += r * _rnd.uniform(0.9, 1.15)
    if gore:
        for k in range(max(1, int(d / 0.45))):
            at = t + _rnd.uniform(0.05, max(0.06, d - 0.15))
            gs(_rnd.choice(["splat_1", "splat_2", "blood_spray_1", "blood_spray_2", "squelch", "flesh_rip"]), at, 0.45)
        for k in range(max(1, int(d / 0.9))):
            at = t + _rnd.uniform(0.05, max(0.06, d - 0.2))
            gs(_rnd.choice(["explode_1", "explode_2", "boom", "krunch_scream_%d" % _rnd.randint(1, 9), "bonecrack", "hit"]), at, 0.4)
def drive_fx(t, d):
    for k in range(max(1, int(d / 0.5))):
        at = t + _rnd.uniform(0.05, max(0.06, d - 0.2))
        gs(_rnd.choice(["car_hit", "splat_1", "splat_2", "scream_man", "scream_woman", "bonecrack", "car_screech"]), at, 0.5)
def click(at):
    sfx("click", at - 0.04, 0.8); sfx("glitch", at, 0.35)

# ===================================================================== 0. COLD OPEN (score_1 intro, 0 -> 12.55 s)
music(S1, 0.0, 0.0, 12.55, gain=0.6, fi=0.0, fo=0.02)
black(0.5)
vo("v01", 0.45)                                                  # "This winter..."
note("Drongus's tower bursts out of the town square (pseudo-3D)", "f_rise: Hub, Chapter 1 (hub3d rise shot)")
shot("f_rise", 130, 330, crop=(100, 56, 760, 428), crop1=(180, 100, 600, 338), cine=True, fin=0.5)
vo("v02b", now() - 0.6)                                          # "Krelford... has run out of pussy juice."
shot("f_rise", 330, 520, crop=(240, 100, 560, 315), crop1=(100, 56, 760, 428), cine=True)
sfx("subdrop", now() - 0.2, 0.7)
shot("f_rise", 600, 720, crop=(100, 56, 760, 428), cine=True)
sfx("riser", now() - 0.1, 0.6)
shot("f_rise", 760, 760 + max(30, int((12.55 - now()) * 60)), crop=(100, 56, 760, 428), crop1=(250, 120, 460, 259), cine=True, ease="in")

# ===================================================================== 1. ACTION (score_1 from the drop)
t0 = now(); A_END = t0 + 23.9
music(S1, t0, 12.55, 12.55 + 23.9, gain=0.62, fi=0.0, fo=0.15)
sfx("braam", t0 - 0.05, 0.9); sfx("hit2", t0, 0.6)
note("Swoop over Krelford into the Crobley Factory (pseudo-3D)", "f_factory: Dungeon crobley_factory (dungeonSwoop)")
shot("f_factory", 40, 190, crop=(100, 56, 760, 428), cine=True, flash=0.25)
shot("f_factory", 300, 410, crop=(100, 56, 760, 428), crop1=(160, 90, 640, 360), cine=True)
sfx("whoosh", now() - 0.15, 0.6)
shot("f_factory", 600, 668, crop=(100, 56, 760, 428), cine=True)
vo("v03", now() - 0.05)                                          # "Shoot everything."
note("Polson Towers, The Mould Zone: top-down, gold minigun", "d_polson1: Dungeon polson_towers room 1")
t = shot("d_polson1", 1040, 1140, crop=near(480, 280, 600), shake=4); combat(t, now() - t, "kreddler")
t = shot("d_polson1", 1220, 1300, crop=near(470, 290, 520), shake=7); combat(t, now() - t, "kreddler")
vo("v04", now() - 0.05)                                          # "Climb everything."
if have("f_tower"):
    note("Climbing the Cronster's tower, side-on", "f_tower: Dungeon ministry room 0 (tower climb)")
    t = shot("f_tower", 790, 935, crop=near(230, 250, 460), crop1=near(220, 235, 420)); combat(t, now() - t, "disco", gore=False, g=0.3)
else:
    note("Catford High Street side-scroller with SanMik and SanChz", "f_sanmik: Dungeon arena_sanmik room 1 (the SanMikverse)")
    shot("f_sanmik", 400, 460, crop=(100, 56, 760, 428), cine=True)
    t = shot("f_sanmik", 1190, 1300, crop=near(480, 420, 560), crop1=near(500, 425, 520), shake=4); combat(t, now() - t, "kreddler")
vo("v05", now() - 0.05)                                          # "Crawl through a seven-hundred-pound man's colon."
note("Uncle Rik in the Giant Hot Tub of Catford; shrink; INSIDE UNCLE RIK", "f_colon: Dungeon rik_colon (colonEntry)")
shot("f_colon", 0, 110, crop=(100, 56, 760, 428), crop1=(250, 100, 480, 270), cine=True)
shot("f_colon", 150, 225, crop=(100, 56, 760, 428), cine=True)
sfx("whoosh", now() - 0.1, 0.6)
shot("f_colon", 355, 399, crop=(100, 56, 760, 428), cine=True)
vo("v06", now() - 0.05)                                          # "Run over twenty-five pedestrians... for a friend."
note("BeepBeep: SanMik's stolen Range Rover (pseudo-3D road)", "f_beep: BeepBeep")
t = shot("f_beep", 2100, 2280, shake=3); drive_fx(t, now() - t)
t = shot("f_beep", 2490, 2610, shake=5); drive_fx(t, now() - t)
note("Night of Freedom: SanMik drives, you're on the guns", "f_drive: Drive")
t = shot("f_drive", 2070, 2170, crop=(0, 60, 800, 450), shake=6); combat(t, now() - t, "gatling")
t = shot("f_drive", 2340, 2340 + max(30, int((A_END - now()) * 60)), crop=(80, 60, 800, 450), shake=8); combat(t, now() - t, "gatling"); gs("rocket", t + 0.1, 0.5)

if have("f_wonk"):
    vo("v19", now() - 0.05)                                      # "Wonk... your... THANG."
    note("WONK YOUR THANG: the krezz jet stream", "f_wonk: Dungeon crobley_factory room 1 (jetStream)")
    t = shot("f_wonk", 1070, 1265, crop=near(420, 360, 720), crop1=near(440, 380, 600), flash=0.15); gs("wonk", t, 0.8); gs("squelch", t + 0.5, 0.6); gs("splat_1", t + 1.2, 0.6); gs("splat_2", t + 2.2, 0.6)

# ===================================================================== 2. FEATURES (groove)
t1 = now()
sfx("scratch", t1 - 0.08, 0.9)

vo("v07", t1 + 0.05)                                             # "Upgrade your arsenal."
note("The gun rack at home", "f_rack: Home, gun rack")
shot("f_rack", 240, 340, crop=(0, 0, 960, 540), crop1=(60, 60, 720, 405))
note("The Kreddle Exchange: Pussy Juice Constitution, Resting Wonk Hand", "f_bank: Kreddle Exchange menu")
shot("f_bank", 190, 290, crop=(0, 0, 960, 540), crop1=(0, 20, 640, 360))
sfx("kaching", now() - 0.15, 0.6)
note("...then put it to use: the Crobley Factory floor and the Catford Job Centre", "d_factory1 / d_sanmik2: Dungeon crobley_factory room 1, arena_sanmik room 2")
sfx("hit1", now(), 0.9)
for c, a, b, cr in [("d_factory1", 440, 530, near(440, 400, 580)), ("d_sanmik2", 760, 850, near(400, 410, 560)), ("d_factory1", 560, 650, near(560, 300, 640)),
                     ("d_sanmik2", 1180, 1270, near(480, 410, 560)), ("d_factory1", 680, 770, near(460, 330, 600))]:
    t = shot(c, a, b, crop=cr, shake=7, flash=0.05); sfx("hit1", now() - 0.02, 0.35); combat(t, now() - t, "bfk" if c == "d_factory1" else "kreddler", g=0.4)
vo("v08", now() - 0.05)                                          # "Gamble your life savings at the Kreddle Exchange."
note("Over the bridge into Kreddle (pseudo-3D)", "f_kreddle: Kreddle (kreddleCrossing)")
shot("f_kreddle", 90, 300, crop=(100, 56, 760, 428), cine=True)
note("Krazy Reels", "f_slots: Kreddle slots")
t = shot("f_slots", 940, 1060, crop=near(480, 270, 700), crop1=near(480, 260, 560)); gs("slot_spin", t, 0.5); gs("jackpot", t + 0.9, 0.5)
vo("v09", now() - 0.05)                                          # "Enjoy a tasteful evening at the Wonky Pole."
if have("f_club"):
    note("The Wonky Pole: watching up close (the game's own censor bars)", "f_club: Club, ClubCloseup")
    shot("f_club", 690, 790)
    shot("f_club", 1330, 1420)
    t = shot("f_club", 1600, 1650); gs("zip_down", t, 0.6)
    t = shot("f_club", 1745, 1835, flash=0.15); gs("squelch", t, 0.7); gs("moan_men_1", t + 0.1, 0.5)
else: todo("[WONKY POLE: CAPTURING]", 3.0)
if have("f_tap"):
    vo("v20", now() + 0.05)                                      # "Restore the national drink."
    note("The Great Pussy Juice Tap flows again", "f_tap: Hub, Chapter 1 clear (Tap flow)")
    t = shot("f_tap", 225, 345, flash=0.2); gs("tap_gush", t, 0.8); gs("cheer", t + 0.6, 0.5)
    shot("f_tap", 372, 420)
    shot("f_tap", 676, 790)                                      # GRONNY: "Me have pussy juice! ME HAVE PUSSY JUICE!"

# ===================================================================== 3. KRELTV (the telly carries itself: music out, remote clicks)
t2 = now()
music(MB, t1, 0.0, min(29.5, t2 - t1), gain=0.55, fi=0.0, fo=0.3)
sfx("scratch", t2 - 0.05, 0.6)
vo("v10", t2 + 0.1)                                              # "Watch the finest television ever broadcast."
click(t2 + 0.05)
note("KrelTV · Krunche News: #ArsebrushGate", "tv_arse1/2: TV krews_arsebrush")
shot("tv_arse1", 120, 245, crop=SET, lines_on=False)
shot("tv_arse1", 250, 470, crop=SCR)                             # "We brush our teeth to get rid of food and plaque."
shot("tv_arse1", 638, 905, crop=SCR)                             # "We should also brush the inside of our arseholes, to get all the shit out."
shot("tv_arse2", 380, 560, crop=SCR)
click(now())
note("KrelTV · Krunche News: Andy Burnham's First Act", "tv_burnham: TV krews_burnham_first_act")
t = shot("tv_burnham", 900, 1110, crop=SET); gs("burn_strain", t + 0.1, 0.7); gs("burn_vomit", t + (1080 - 900) / 60, 0.9)
shot("tv_burnham", 1482, 1660, crop=SCR)
click(now())
note("KrelTV · Krunche News: the Wetherspoons Cabinet's justice reform", "tv_wire: TV krews_justice")
shot("tv_wire", 180, 370, crop=SCR)
shot("tv_wire", 1353 + 180, 1353 + 488, crop=SCR)
click(now())

# ===================================================================== 4. POLSON
vo("v11", now() + 0.05)                                          # "Meet Polson. He's on a journey."
t3 = now()
if have("f_pgym"):
    note("Polson Gets Fit", "f_pgym: Vignette polson_gym")
    shot("f_pgym", 720, 900)
    shot("f_pgym", 954, 1075)
    shot("f_pgym", 1142, 1215); gs("trombone", now() - 0.3, 0.35)
    shot("f_pgym", 1790, 1920)
else: todo("[POLSON AT THE GYM: CAPTURING]", 4.0)
if have("f_pcctv"):
    note("Polson's gym, as seen on the War Room CCTV", "f_pcctv: Vignette polson_cctv")
    CAM1 = (30, 40, 440, 247.5)
    t = shot("f_pcctv", 1520, 1600, crop=CAM1); gs("fart_2", t + 0.1, 0.8)
    shot("f_pcctv", 1797, 1890)                                  # "Core is on fire!!"
    shot("f_pcctv", 1929, 2015)                                  # KREZWONK: "It's not his core that's on fire."
    t = shot("f_pcctv", 2700, 2830, flash=0.2); gs("squelch", t, 0.7); gs("splat_1", t + 0.3, 0.6); gs("splat_2", t + 0.7, 0.6)
if have("f_sludge"):
    note("Sludge time: the fart flashback", "f_sludge: Meeting fragmar_briefing")
    t = shot("f_sludge", 2690, 2800); gs("fart_3", t + 0.05, 0.9); gs("fart_1", t + 0.7, 0.6)
    shot("f_sludge", 2975, 3065)
    t = shot("f_sludge", 3215, 3258); gs("door", t, 0.8)
    shot("f_sludge", 3455, 3500)
    t = shot("f_sludge", 3520, 3599); gs("fart_2", t, 0.9); gs("splash", t + 0.4, 0.7)
else: todo("[POLSON: SLUDGE TIME: CAPTURING]", 3.0)

# ===================================================================== 5. BOSSES + KRELTALITIES (mC)
t4 = now()
music(MB, t3, 4.0, 4.0 + min(25.5, t4 - t3), gain=0.42, fi=0.1, fo=0.3)
sfx("braam", t4 - 0.05, 0.8)
vo("v12", t4 + 0.1)                                              # "Face unspeakable evil."
if have("f_hoard"):
    note("The Cyst: Polson's pilonidal cyst, risen from his hoard", "f_hoard: Dungeon polson_towers room 3")
    shot("f_hoard", 1793, 1940, crop=(0, 120, 960, 540))         # POLSON: "Is that... is that my CYST?? Lmao"
    t = shot("f_hoard", 1470, 1668, flash=0.15, lines_on=False); gs("roar", t + 0.05, 0.7)   # the anime cut-in
    ev("line", line_wav(next(r for f, r, sp, x in lines("f_hoard") if f == 2225)), t + 0.25, 1.0, d=4.55, fo=0.08, who="THE CYST", text="I'M AN ARSEHOLE CYST. YOU CAN'T LEAVE.")
    shot("f_hoard", 2400, 2470, crop=(0, 120, 960, 540), lines_on=False)
if have("f_reinhardt"):
    note("Reinhardt Crobley", "f_reinhardt: Dungeon crobley_factory room 4")
    shot("f_reinhardt", 995, 1085)                                # anime cut-in: crushing a Crobley
    shot("f_reinhardt", 1500, 1628)                               # "...You vile fucking cunt."
    t = shot("f_reinhardt", 2975, 3050, flash=0.1); sfx("hit2", t, 0.6)   # VS
    t = shot("f_reinhardt", 3170, 3300, crop=near(480, 370, 640), shake=5); combat(t, now() - t, "kreddler", g=0.25)   # "COME HERE, YOU LITTLE CUNT!"
    t = shot("f_reinhardt", 3780, 3905, crop=near(480, 370, 640), shake=5); combat(t, now() - t, "kreddler", g=0.25)   # "WHAT ARE YOU LOOKING AT, YOU FUCKING CUNT?"
else: todo("[REINHARDT CROBLEY: \"YOU VILE FUCKING CUNT\": CAPTURING]", 4.0)
if have("f_jam"):
    note("JQ, the Jam Queen", "f_jam: Dungeon arena_sanmik room 3")
    L = {f: ed_line for f, ed_line in [(f, line_wav(rec)) for f, rec, sp, txt in lines("f_jam") if rec]}
    t = shot("f_jam", 2905, 2985, flash=0.1, lines_on=False); sfx("hit2", t, 0.6)          # VS
    ev("line", L[600], t + 0.2, 1.0, fin=0.75, d=5.2, fo=0.1, who="JQ", text="Where is he? Where is the man who shagged my daughter's jam hole?")
    t = shot("f_jam", 3150, 3420, crop=near(480, 360, 700), lines_on=False); combat(t, now() - t, "disco", g=0.22)
    t2 = now()
    ev("line", L[1101], t2 - 0.1, 1.0, fin=6.85, d=8.5, fo=0.1, who="JQ", text="...and you stuck your autistic love truncheon in her jam zone, which is a donut's pussy.")
    t = shot("f_jam", 3420, 3700, crop=near(480, 360, 700), lines_on=False); combat(t, now() - t, "disco", g=0.22)
    t = shot("f_jam", 3870, 4110, crop=near(480, 360, 700), lines_on=False); combat(t, now() - t, "disco", g=0.22); gs("wonk", now() - 0.6, 0.7)
else: todo("[JQ THE JAM QUEEN: \"...SHAGGED MY DAUGHTER'S JAM HOLE\": CAPTURING]", 4.0)
if have("f_flirt"):
    note("Flirt Crobley", "f_flirt: Dungeon crobley_factory room 3")
    LF = {f: line_wav(rec) for f, rec, sp, txt in lines("f_flirt") if rec}
    shot("f_flirt", 1726, 1845, crop=(0, 120, 960, 540))         # "You want to krezz inside me, don't you?"
    shot("f_flirt", 2064, 2142, crop=(0, 120, 960, 540))         # "Let me see your hard thang."
    shot("f_flirt", 2222, 2272, crop=(0, 120, 960, 540))         # KREZMAR: "It's a gun."
    t = shot("f_flirt", 2945, 3020, flash=0.1, lines_on=False); sfx("hit2", t, 0.6)          # VS
    ev("line", LF[2329], t + 0.1, 1.0, d=5.6, fo=0.1, who="FLIRT CROBLEY", text="A gun, eh? Why not come and shag me very hard and sexually?")
    t = shot("f_flirt", 3170, 3420, crop=near(480, 380, 640), lines_on=False); combat(t, now() - t, "bfk", g=0.3)
else: todo("[FLIRT CROBLEY: \"SHAG ME VERY HARD AND SEXUALLY\": CAPTURING]", 4.0)
note("KRELTALITIES", "f_krels: Dungeon pit_range, krelOn(boss, finisher) on Reinhardt, Tank, the Jam Queen, Fruity, Chad Deltoid")
vo("v13", now() + 0.05)                                          # "And when it's over..."
shot("f_krels", 1235, 1345, crop=(80, 20, 800, 450))             # KRELTALITY
vo("v14", now() - 0.1)                                           # "MAKE SURE."
sfx("subdrop", now(), 0.8)
for a, b, fx in [(436, 512, ["flesh_rip", "squelch"]), (1078, 1150, ["splash", "shriek_1"]), (1505, 1578, ["flesh_rip", "bonecrack"]),
                 (2042, 2125, ["punch_big", "bonecrack"]), (2735, 2825, ["explode_2", "splat_1"]), (3336, 3445, ["swing", "flesh_rip"])]:
    t = shot("f_krels", a, b, flash=0.08, shake=6)
    sfx("hit1", t, 0.7); gs(fx[0], t + 0.05, 0.8); gs(fx[1], t + 0.35, 0.7)

# ===================================================================== 6. TITLE + END CARD
t5 = now()
# the boss cue's final hit (38.5 s in) lands on the title; the action score carries the bosses until it starts
mc0 = t5 - 38.5
if mc0 > t4: music(S1, t4, 40.0, 40.0 + (mc0 - t4) + 0.3, gain=0.55, fi=0.0, fo=0.3)
music(MC, max(t4, mc0), max(0.0, t4 - mc0), 39.5, gain=0.62, fi=0.2 if mc0 > t4 else 0.0, fo=0.05)
sfx("hit2", t5, 0.9)
card("title.png", 2.0, z0=1.15, z1=1.0, flash=0.3)
vo("v15", t5 + 0.15)
t6 = now()
card("endcard.png", 6.2, z0=1.04, z1=1.0, fout=0.5)
vo("v16", t6 + 0.4); vo("v17", t6 + 2.8)
ev("mus", M + "crazy_hook.wav", t6 + 0.05, 0.45, fi=0.05, fo=0.4)
