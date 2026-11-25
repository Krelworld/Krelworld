# v2: rebuilt around the political breaking-news stories. exec'd by edit.py (BODY=edit_body_v2.py OUT=krelworld_tv_v2)
V = T + "vo/"; X = T + "sfx/"
def surf(clip, a, b, fr="set", ch=1, st=6, **kw):
    click(now(), st); shot(clip, a, b, fr=fr, static=st, osd=ch, **kw)
def end_of(clip, i):
    """capture frame where the i-th logged line's recording ends"""
    f, sp, txt, key = S(clip)[i]
    return f + int(round(dur(line_wav(key)) * FPS))

# ============ 0. COLD OPEN (as v1)
shot("c_room", 20, 100, fr="room", fin=0.3)
fx(GSFX + "amb_town.mp3", 0.0, 0.18, d=1.5, fo=0.4)
fx(X + "click.mp3", now() - 0.12, 1.0)
t = now(); chan("KRUNCHE NEWS · A Message From Our Neighbours (President Klerble of Kreddle)", "Ch1 (game's opening broadcast)")
fx(X + "crt_on.mp3", t - 0.05, 0.75)
shot("c_relax", 268, 440, fr="set", static=9)
shot("c_relax", 440, 545, fr="scr")
music(GMUS + "klerble.mp3", t, now() - t + 0.3, g=0.22, fi=0.05, fo=0.3)
t = now(); click(t, 7)
card("tonight", 2.4, static=7, fout=0.08)
EV.append(dict(bus="vo", file=V + "vo_tonight.mp3", at=t + 0.3, gain=1.0))
fx(X + "news_sting.mp3", t + 0.05, 0.45, d=2.4, fo=0.4)

# ============ 1. THE SURF: the bulletins
chan("KRUNCHE NEWS · News at Six 1: The Great Silence", "Ch1")
surf("c_nine", 165, 383)                               # "...was seen by nine people. Nine."
shot("c_nine", 545, 742, fr="scr")                     # "...has described this as fuuuuck."
chan("KRUNCHE NEWS · Andy Burnham's First Act", "Ch1 (always on)")
surf("v_north", 138, 296)                              # "The North is much better than the South!
shot("v_north", 296, end_of("v_north", 0) + 22, fr="scr")      #  Legally binding. No appeals. We're putting it in the bloody constitution!"
chan("KRUNCHE NEWS · Government Announces Plan to Nuke Antarctica", "Ch1 (always on)")
surf("v_nuke", 296, 390)                               # CORBYN: "...and what could be more fun
shot("v_nuke", 390, end_of("v_nuke", 0) + 30, fr="scr")       #  than watching a nuclear explosion?"
chan("KRUNCHE NEWS · Markets Rally on £20 Billion 'Random Public Investment'", "Ch1 (always on)")
surf("v_buylow", 110, 213)                             # STARMER: "Buy low, sell high! Buy low, sell high!
shot("v_buylow", 213, end_of("v_buylow", 0) + 14, fr="scr")   #  BUY LOW, SELL HIGH!"
chan("KRUNCHE NEWS: CABINET PROCEEDINGS LIVE · Highlights: The Ministries", "Ch1 (always on)")
d1 = L("v_defence", 1)
surf("v_defence", 0, d1)                               # KREZMAR: "We have no defence minister?!"
shot("v_defence", d1, end_of("v_defence", 1) + 24, fr="scrlo")  # DRONGUS: "I was distracted by the need for all the other ministers."
chan("KRUNCHE NEWS · Kill the Patient 2: No Alibi", "Ch1 (always on)")
k1 = L("c_ktp", 1)
surf("c_ktp", 132, k1, st=5)                          # "...a spokesperson replied..."
shot("c_ktp", k1, k1 + 150, fr="scr")                 # HOSPITAL SPOKESPERSON: "This is the sequel."
chan("KRUNCHE NEWS · Election Special: FartGate", "Ch1 (always on)")
s1 = L("v_smell", 1)
surf("v_smell", 528, s1)                            # "And to the Prime Minister, I say just one thing."
shot("v_smell", s1, end_of("v_smell", 1) + 30, fr="scr")      # "Smell that, Sunak! Phwoar! Lovely!"
r1 = L("v_real", 1)
shot("v_real", 384, r1, fr="set")                      # (the apology presser) "...earning back the trust of the British people."
shot("v_real", r1, end_of("v_real", 1) + 8, fr="scr")  # REPORTER: "Mr Starmer! Was it a real one?"
shot("v_real", 628, 657, fr="scr")                     # (Starmer: a long pause)
chan("KRUNCHE NEWS · The Department of Telly", "Ch1 (always on)")
surf("c_telly", 4, 140, fr="scr", st=4)                # "You're watching it either way."
# ============ 2. CLIMAX: #ArsebrushGate
chan("KRUNCHE NEWS · #ArsebrushGate", "Ch1 (always on)")
surf("c_arse", 158, 292, st=5)                         # "We should also brush the inside of our arseholes
shot("c_arse", 292, 438, fr="scr")                     #  to get all the shit out."
shot("v_whitty", 230, 432, fr="set")                  # JOURNALIST: "...official guidance? Or equipment?"
shot("v_whitty", 432, 574, fr="scr")                  # WHITTY: "Research is ongoing." (and a beat of silence)
# ============ 3. BUTTON: Kreddle again (as v1)
chan("KRUNCHE NEWS · A Message From Our Neighbours (President Klerble)", "Ch1")
t = now(); surf("c_keep", 0, 184, st=6)
shot("c_keep", 184, 284, fr="scr")
music(GMUS + "klerble.mp3", t, now() - t + 0.2, g=0.22, fin=6.0, fi=0.05, fo=0.2)
import crtoff
pat, n = crtoff.make("c_keep", 283)
SH.append(dict(kind="seq", pattern=pat, n=n, tag="crtoff"))
fx(X + "crt_off.mp3", now() - n / FPS - 0.02, 0.8)
black(0.35)
t = now()
card("endcard", 5.6, fin=0.25, fout=0.4)
EV.append(dict(bus="vo", file=V + "vo_end.mp3", at=t + 0.45, gain=1.0))
music(X + "jingle.mp3", t, 5.6, g=0.5, fi=0.05, fo=1.0)
