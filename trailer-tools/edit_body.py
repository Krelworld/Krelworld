# exec'd by edit.py. Frame numbers are capture frames (60 per s) from the start of each clip's target line.
V = T + "vo/"; X = T + "sfx/"
def surf(clip, a, b, fr="set", ch=1, st=6, **kw):
    click(now(), st); shot(clip, a, b, fr=fr, static=st, osd=ch, **kw)

# ============ 0. COLD OPEN: the living room, the little telly in the corner
shot("c_room", 20, 100, fr="room", fin=0.3)
fx(GSFX + "amb_town.mp3", 0.0, 0.18, d=1.6, fo=0.4)
fx(X + "click.mp3", now() - 0.12, 1.0)
# ============ 1. ON: Kreddle's President, on Krunche News (the Ch1 welcome broadcast)
t = now(); chan("KRUNCHE NEWS · A Message From Our Neighbours (President Klerble of Kreddle)", "Ch1 (game's opening broadcast)")
fx(X + "crt_on.mp3", t - 0.05, 0.75)
shot("c_relax", 268, 440, fr="set", static=9)       # "Sit down, watch the telly,
shot("c_relax", 440, 545, fr="scr")                  #  get hooked on the telly."
music(GMUS + "klerble.mp3", t, now() - t + 0.3, g=0.22, fi=0.05, fo=0.3)
# ============ 2. TONIGHT ON KRELTV
t = now(); click(t, 7)
card("tonight", 2.4, static=7, fout=0.08)
EV.append(dict(bus="vo", file=V + "vo_tonight.mp3", at=t + 0.3, gain=1.0))
fx(X + "news_sting.mp3", t + 0.05, 0.45, d=2.4, fo=0.4)
# ============ 3. THE SURF
chan("KRUNCHE NEWS · News at Six 1: The Great Silence", "Ch1")
surf("c_nine", 165, 383)                              # "...was seen by nine people. Nine."
shot("c_nine", 545, 742, fr="scr")                    # "...has described this as fuuuuck."
chan("CHANNEL KREZ · Krelbank (advert)", "Ch1 (always on)")
t = now(); surf("c_mug", 0, 205, ch=2)               # "You left a dirty mug in the sink! Taking 5k off!"
music(GMUS + "krelbank_ad.mp3", t, now() - t, g=0.3, fi=0.05, fo=0.1)
chan("KRUNCHE NEWS · News at Six 3: Boner Control", "unlocks after Ch2")
surf("c_purple", 0, 368)                              # "Threat level today: purple... high or low."
shot("c_purple", 368, 440, fr="scr")                  # "We cannot."
chan("BBK ONE · Mole of Thrones", "Ch1 (always on)")
surf("c_mole", 384, 520, ch=3)                        # "This is showbiz, Jenko."
shot("c_mole", 520, 646, fr="grrm")                  # "We need permanent moles."
chan("KRELWORLD DOCUMENTARIES · Krelworld: The Creation Myth", "Ch1 (always on)")
surf("c_godric", 2, 172, ch=5)                        # "Fuck... I can't fucking believe it..."
shot("c_godric", 222, 312, fr="scrlo")               # "Godric Gryffindor."
shot("c_godric", 505, 598, fr="set")                 # RONSON: "Godric Gryffindor?"
shot("c_godric", 644, 742, fr="scrlo")               # "From Harry Potter."
chan("BBK ONE · Cheap as Chips: Dickinson for President", "Ch1 (always on)")
d1 = L("c_dick", 1)
surf("c_dick", 0, d1, ch=3)                           # "Mr. Dickinson, your stance on healthcare reform?"
shot("c_dick", d1, d1 + 120, fr="scrlo")              # "Bargain hunt!"
shot("c_dick", 356, 383, fr="set")                    # (Trump, flabbergasted)
fx(GMUS + "laugh_track.mp3", now() - 1.2, 0.35, d=1.4, fo=0.5)
chan("KRUNCHE NEWS · Universes Collide", "Ch1 (always on)")
u1 = L("c_univ", 1)
surf("c_univ", 100, 346)                                # "...transform into characters from the sex themed universe."
shot("c_univ", u1 - 66, u1 + 165, fr="scr")          # (a long stare) "Back to the studio."
chan("KRUNCHE NEWS · \"Moneybags\" Trial Ends With Not Guilty Verdict", "Ch1 (always on)")
b1 = L("c_bag", 1)
surf("c_bag", 172, b1, st=5)                          # "Judge Krelmor, what's in the bag?"
shot("c_bag", b1, b1 + 88, fr="scr")                  # "No comment."
# ---- faster now
chan("KRUNCHE NEWS · #ArsebrushGate", "Ch1 (always on)")
surf("c_arse", 158, 292, st=5)                        # "We should also brush the inside of our arseholes
shot("c_arse", 292, 436, fr="scr")                    #  to get all the shit out."
shot("c_whitty", 4, 150, fr="set")                    # "Research is ongoing."
chan("KRUNCHE NEWS · Kill the Patient 2: No Alibi", "Ch1 (always on)")
k1 = L("c_ktp", 1)
surf("c_ktp", 14, k1, st=4)                           # "Asked to explain the difference, a spokesperson replied..."
shot("c_ktp", k1, k1 + 140, fr="scr")                 # "This is the sequel."
chan("KRUNCHE NEWS · The Department of Telly", "Ch1 (always on)")
surf("c_telly", 4, 140, fr="scr", st=4)               # "You're watching it either way."
# ============ 4. BUTTON: Kreddle again
chan("KRUNCHE NEWS · A Message From Our Neighbours (President Klerble)", "Ch1")
t = now(); surf("c_keep", 0, 184, st=6)               # "Keep watching, Krelworld. Keep watching." (over the Krunche ident)
shot("c_keep", 184, 284, fr="scr")                    # "NO FURTHER QUESTIONS!"
music(GMUS + "klerble.mp3", t, now() - t + 0.2, g=0.22, fin=6.0, fi=0.05, fo=0.2)
import crtoff
pat, n = crtoff.make("c_keep", 283)
SH.append(dict(kind="seq", pattern=pat, n=n, tag="crtoff"))
fx(X + "crt_off.mp3", now() - n / FPS - 0.02, 0.8)
black(0.35)
# ============ 5. END CARD
t = now()
card("endcard", 5.6, fin=0.25, fout=0.4)
EV.append(dict(bus="vo", file=V + "vo_end.mp3", at=t + 0.45, gain=1.0))
music(X + "jingle.mp3", t, 5.6, g=0.5, fi=0.05, fo=1.0)
