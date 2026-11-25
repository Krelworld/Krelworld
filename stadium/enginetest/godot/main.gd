extends Node2D
# Engine test: pitch, 22 players, 300 crowd, controllable fat man, joystick, beep.
const W := 1600.0
const H := 1000.0
const PITCH := Rect2(400, 250, 800, 500)
var crowd: Array = []
var players: Array = []
var pies: Array = []
var me := Vector2(300, 500)
var joy_id := -1
var joy_origin := Vector2.ZERO
var joy_vec := Vector2.ZERO
var rng := RandomNumberGenerator.new()
var acc := 0.0
var frames := 0

func _ready() -> void:
	rng.seed = 12345
	for i in 300:
		var p := Vector2(rng.randf() * W, rng.randf() * H)
		while PITCH.grow(20).has_point(p):
			p = Vector2(rng.randf() * W, rng.randf() * H)
		crowd.append({"p": p, "t": p, "c": Color.from_hsv(rng.randf(), 0.5, 0.9)})
	for i in 22:
		var p2 := Vector2(PITCH.position.x + rng.randf() * PITCH.size.x, PITCH.position.y + rng.randf() * PITCH.size.y)
		players.append({"p": p2, "t": p2, "c": Color.WHITE if i < 11 else Color(0.9, 0.8, 0.1)})
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_8_BITS
	wav.mix_rate = 22050
	var data := PackedByteArray()
	for i in 3300:
		var s := sin(i * 0.25) * (1.0 - i / 3300.0)
		data.append(int(s * 100) & 0xFF)
	wav.data = data
	$Audio.stream = wav

func _input(ev: InputEvent) -> void:
	var vp := get_viewport_rect().size
	if ev is InputEventScreenTouch:
		if ev.pressed:
			if ev.position.x < vp.x * 0.5 and joy_id == -1:
				joy_id = ev.index
				joy_origin = ev.position
				joy_vec = Vector2.ZERO
			elif ev.position.x >= vp.x * 0.5:
				_action()
		elif ev.index == joy_id:
			joy_id = -1
			joy_vec = Vector2.ZERO
	elif ev is InputEventScreenDrag and ev.index == joy_id:
		joy_vec = ((ev.position - joy_origin) / 50.0).limit_length(1.0)

func _action() -> void:
	$Audio.play()
	var d := joy_vec if joy_vec.length() > 0.1 else Vector2.RIGHT
	pies.append({"p": me, "v": d.normalized() * 500.0, "life": 1.2})

func _wander(a: Dictionary, r: Rect2, sp: float, dt: float) -> void:
	var d: Vector2 = a.t - a.p
	if d.length() < 4.0:
		a.t = Vector2(r.position.x + rng.randf() * r.size.x, r.position.y + rng.randf() * r.size.y)
	else:
		a.p += d.normalized() * sp * dt

func _process(dt: float) -> void:
	var kb := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	var mv := joy_vec if joy_vec.length() > 0.05 else kb
	me += mv * 160.0 * dt
	me = me.clamp(Vector2.ZERO, Vector2(W, H))
	for a in crowd:
		_wander(a, Rect2(0, 0, W, H), 40.0, dt)
	for a in players:
		_wander(a, PITCH, 120.0, dt)
	for p in pies:
		p.p += p.v * dt
		p.life -= dt
	pies = pies.filter(func(p): return p.life > 0.0)
	$Cam.position = me
	acc += dt
	frames += 1
	if acc >= 0.5:
		$UI/Fps.text = "Godot  %d fps" % int(frames / acc)
		acc = 0.0
		frames = 0
	queue_redraw()

func _draw() -> void:
	draw_rect(Rect2(0, 0, W, H), Color(0.25, 0.27, 0.3))
	draw_rect(PITCH, Color(0.18, 0.5, 0.22))
	draw_rect(PITCH, Color.WHITE, false, 3.0)
	draw_line(Vector2(800, 250), Vector2(800, 750), Color.WHITE, 3.0)
	draw_arc(Vector2(800, 500), 70, 0, TAU, 48, Color.WHITE, 3.0)
	for a in crowd:
		draw_rect(Rect2(a.p - Vector2(7, 7), Vector2(14, 14)), a.c)
	for a in players:
		draw_circle(a.p, 9, a.c)
	for p in pies:
		draw_circle(p.p, 6, Color(0.8, 0.5, 0.2))
	draw_circle(me, 16, Color(0.85, 0.1, 0.1))
	draw_circle(me, 9, Color.WHITE)
	if joy_id != -1:
		var inv := get_canvas_transform().affine_inverse()
		draw_arc(inv * joy_origin, 50, 0, TAU, 32, Color(1, 1, 1, 0.5), 3.0)
		draw_circle(inv * (joy_origin + joy_vec * 50.0), 20, Color(1, 1, 1, 0.5))
