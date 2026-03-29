# GDScript Reference for AI Agents (Godot 4.x)

Curated reference to prevent common LLM hallucinations when writing GDScript.

---

## 1. GDScript Basics

### Type Annotations

```gdscript
var speed: float = 100.0
var name: String = "Player"
var health: int = 100
var items: Array[String] = []
var data: Dictionary = {}
```

### Signals

```gdscript
signal health_changed(new_health: int)
signal died

# Emitting
health_changed.emit(50)
died.emit()

# Connecting
enemy.health_changed.connect(_on_enemy_health_changed)
```

### Annotations

```gdscript
@onready var sprite: Sprite2D = $Sprite2D
@export var speed: float = 200.0
@export_range(0, 100) var volume: int = 80
@tool  # Makes script run in editor
```

### Lifecycle Methods

```gdscript
func _ready() -> void:
	# Called once when node enters scene tree
	pass

func _process(delta: float) -> void:
	# Called every frame
	pass

func _physics_process(delta: float) -> void:
	# Called every physics tick (default 60/s)
	pass

func _input(event: InputEvent) -> void:
	# Called on any input event
	pass

func _unhandled_input(event: InputEvent) -> void:
	# Called for input not consumed by _input or UI
	pass
```

### Scene Tree Access

```gdscript
$Sprite2D                       # Direct child by name
$UI/HealthBar                   # Nested path
get_node("Sprite2D")            # Equivalent to $Sprite2D
get_parent()                    # Parent node
get_tree()                      # SceneTree reference
get_children()                  # Array of child nodes
```

### Instancing Scenes

```gdscript
var bullet_scene = preload("res://scenes/bullet.tscn")

func spawn_bullet():
	var bullet = bullet_scene.instantiate()
	bullet.position = position
	get_parent().add_child(bullet)
```

### Classes and Inheritance

```gdscript
extends Node2D
class_name MyCustomNode  # Registers globally

func _ready():
	super()  # Call parent _ready
```

### Enums

```gdscript
enum State { IDLE, RUNNING, JUMPING }
var current_state: State = State.IDLE
```

### Match (Pattern Matching)

```gdscript
match current_state:
	State.IDLE:
		play_idle()
	State.RUNNING:
		play_run()
	_:
		pass  # Default case
```

### Coroutines

```gdscript
func flash():
	modulate = Color.RED
	await get_tree().create_timer(0.2).timeout
	modulate = Color.WHITE
```

---

## 2. Common Patterns by Class

### CharacterBody2D

The primary node for player/enemy movement with collision.

```gdscript
extends CharacterBody2D

@export var speed: float = 300.0
@export var jump_velocity: float = -400.0
var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y += gravity * delta

	if Input.is_action_just_pressed("jump") and is_on_floor():
		velocity.y = jump_velocity

	var direction := Input.get_axis("move_left", "move_right")
	velocity.x = direction * speed

	move_and_slide()
```

Key: `velocity` is a built-in property. `move_and_slide()` takes no arguments in Godot 4 -- it reads `velocity` directly.

### Input

```gdscript
# Polling (in _process or _physics_process)
if Input.is_action_pressed("ui_right"):
	velocity.x = speed
if Input.is_action_just_pressed("jump"):
	jump()
if Input.is_action_just_released("shoot"):
	stop_shooting()

# Event-based (in _input or _unhandled_input)
func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		shoot_at(event.position)
	if event.is_action_pressed("pause"):
		get_tree().paused = !get_tree().paused
```

### Vector2

```gdscript
var pos := Vector2(100, 200)
var dir := Vector2.RIGHT              # (1, 0)
var up := Vector2.UP                  # (0, -1) -- Y is down in 2D

var normalized := pos.normalized()
var dist := pos.distance_to(Vector2.ZERO)
var angle := pos.angle_to(Vector2.RIGHT)
var lerped := pos.lerp(target, 0.1)
var length := pos.length()
```

Common constants: `Vector2.ZERO`, `Vector2.ONE`, `Vector2.UP`, `Vector2.DOWN`, `Vector2.LEFT`, `Vector2.RIGHT`.

### Area2D

Used for overlap detection (pickups, triggers, hitboxes).

```gdscript
extends Area2D

func _ready() -> void:
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)

func _on_body_entered(body: Node2D) -> void:
	if body is CharacterBody2D:
		collect()

func _on_area_entered(area: Area2D) -> void:
	if area.is_in_group("bullets"):
		take_damage()
```

Set collision layers/masks in the inspector or via code:
```gdscript
collision_layer = 2   # What layer this area is ON
collision_mask = 1    # What layers this area DETECTS
```

### Sprite2D

```gdscript
@onready var sprite: Sprite2D = $Sprite2D

func _process(delta: float) -> void:
	sprite.flip_h = velocity.x < 0  # Face movement direction
	sprite.texture = preload("res://art/player.png")
	sprite.modulate = Color(1, 0, 0, 0.5)  # Semi-transparent red
```

Key properties: `texture`, `flip_h`, `flip_v`, `modulate`, `offset`, `region_enabled`, `region_rect`.

### RigidBody2D

Physics-simulated body. Do NOT set position directly -- use forces.

```gdscript
extends RigidBody2D

func _ready() -> void:
	gravity_scale = 1.0
	linear_damp = 0.5

func launch(direction: Vector2, force: float) -> void:
	apply_impulse(direction * force)

func _integrate_forces(state: PhysicsDirectBodyState2D) -> void:
	# Use this instead of _physics_process for direct state manipulation
	if state.linear_velocity.length() > 500:
		state.linear_velocity = state.linear_velocity.normalized() * 500
```

### Camera2D

```gdscript
@onready var camera: Camera2D = $Camera2D

func _ready() -> void:
	camera.make_current()
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = 1920
	camera.limit_bottom = 1080
	camera.position_smoothing_enabled = true
	camera.position_smoothing_speed = 5.0

func shake(intensity: float, duration: float) -> void:
	var tween = create_tween()
	tween.tween_property(camera, "offset", Vector2(randf_range(-intensity, intensity), randf_range(-intensity, intensity)), 0.05)
	tween.tween_property(camera, "offset", Vector2.ZERO, duration)
```

### Label

```gdscript
@onready var label: Label = $UI/ScoreLabel

func update_score(score: int) -> void:
	label.text = "Score: %d" % score
	# Theme overrides for styling
	label.add_theme_font_size_override("font_size", 24)
	label.add_theme_color_override("font_color", Color.YELLOW)
```

Key properties: `text`, `horizontal_alignment`, `vertical_alignment`, `autowrap_mode`.

### CanvasLayer

Used for UI that stays fixed on screen (HUD, menus).

```gdscript
# CanvasLayer is a parent node -- children render on a separate layer
# layer property controls draw order (higher = on top)
@onready var hud: CanvasLayer = $HUD
hud.layer = 10  # Draw above everything
```

### AudioStreamPlayer

```gdscript
@onready var sfx: AudioStreamPlayer = $SFX
@onready var music: AudioStreamPlayer = $Music

func play_sound(stream: AudioStream) -> void:
	sfx.stream = stream
	sfx.play()

func _ready() -> void:
	music.stream = preload("res://audio/bgm.ogg")
	music.play()
	# Use finished signal to loop or chain
	sfx.finished.connect(_on_sfx_finished)
```

Use `AudioStreamPlayer2D` for positional audio.

### SceneTree

```gdscript
# Scene management
get_tree().change_scene_to_file("res://scenes/game_over.tscn")
get_tree().reload_current_scene()
get_tree().quit()

# Groups
add_to_group("enemies")
get_tree().get_nodes_in_group("enemies")
get_tree().call_group("enemies", "take_damage", 10)

# Pause
get_tree().paused = true  # Nodes with process_mode = PROCESS_MODE_ALWAYS still run

# Timers
await get_tree().create_timer(1.0).timeout
```

### TileMap

```gdscript
@onready var tilemap: TileMap = $TileMap

func _ready() -> void:
	# Get tile at position (layer, coords)
	var tile_data = tilemap.get_cell_tile_data(0, Vector2i(5, 3))

	# Set tile (layer, coords, source_id, atlas_coords)
	tilemap.set_cell(0, Vector2i(5, 3), 0, Vector2i(1, 0))

	# Remove tile
	tilemap.erase_cell(0, Vector2i(5, 3))

	# Convert between world and map coords
	var map_pos = tilemap.local_to_map(global_position)
	var world_pos = tilemap.map_to_local(Vector2i(5, 3))
```

### AnimationPlayer

```gdscript
@onready var anim: AnimationPlayer = $AnimationPlayer

func _ready() -> void:
	anim.play("idle")
	anim.animation_finished.connect(_on_animation_finished)

func _on_animation_finished(anim_name: StringName) -> void:
	if anim_name == "attack":
		anim.play("idle")

# Useful methods
anim.stop()
anim.is_playing()
anim.current_animation
anim.play_backwards("walk")
anim.queue("next_anim")
```

### GPUParticles2D

```gdscript
@onready var particles: GPUParticles2D = $GPUParticles2D

func emit_burst() -> void:
	particles.emitting = true
	particles.one_shot = true
	particles.amount = 32

# process_material is a ParticleProcessMaterial -- usually set in editor
# Key properties: emitting, amount, lifetime, one_shot, explosiveness
# For code-created particles:
func setup_particles() -> void:
	var mat = ParticleProcessMaterial.new()
	mat.direction = Vector3(0, -1, 0)  # Yes, Vector3 even for 2D
	mat.initial_velocity_min = 100.0
	mat.initial_velocity_max = 200.0
	particles.process_material = mat
```

### Node2D

Base class for all 2D nodes.

```gdscript
extends Node2D

func _ready() -> void:
	position = Vector2(100, 200)
	rotation = PI / 4          # Radians
	rotation_degrees = 45.0    # Degrees
	scale = Vector2(2, 2)
	visible = false
	z_index = 5                # Draw order
	modulate = Color.RED
```

### CollisionShape2D

Always a child of a physics body or Area2D. Shape set via `shape` property.

```gdscript
@onready var collision: CollisionShape2D = $CollisionShape2D

func disable_collision() -> void:
	collision.disabled = true

# Create shape in code (usually done in editor)
var circle = CircleShape2D.new()
circle.radius = 32.0
collision.shape = circle
```

Shape types: `RectangleShape2D`, `CircleShape2D`, `CapsuleShape2D`, `ConvexPolygonShape2D`.

---

## 3. .tscn File Format

Minimal scene file:

```
[gd_scene load_steps=2 format=3 uid="uid://abc123"]

[ext_resource type="Script" path="res://scripts/player.gd" id="1_abc"]

[node name="Player" type="CharacterBody2D"]
script = ExtResource("1_abc")

[node name="Sprite2D" type="Sprite2D" parent="."]
texture = ExtResource("2_xyz")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
shape = SubResource("RectangleShape2D_abc")

[node name="Camera2D" type="Camera2D" parent="."]
```

Key rules:
- `parent="."` means child of root node
- `parent="UI"` means child of the node named `UI`
- Root node has no `parent` attribute
- `ExtResource("id")` references `[ext_resource]` entries
- `SubResource("id")` references `[sub_resource]` entries (inline resources)

Sub-resources are defined before `[node]` sections:

```
[sub_resource type="RectangleShape2D" id="RectangleShape2D_abc"]
size = Vector2(32, 64)

[sub_resource type="CircleShape2D" id="CircleShape2D_def"]
radius = 16.0
```

---

## 4. .tres Resource Format

Standalone resource files:

```
[gd_resource type="ParticleProcessMaterial" format=3 uid="uid://def456"]

[resource]
direction = Vector3(0, -1, 0)
spread = 45.0
initial_velocity_min = 50.0
initial_velocity_max = 100.0
gravity = Vector3(0, 98, 0)
```

Used for materials, shapes, themes, custom resources. Referenced in `.tscn` files via `ext_resource`.

---

## 5. Known LLM Hallucination Pitfalls

**STOP AND CHECK** -- these are the most common mistakes AI agents make:

| Wrong (Hallucinated) | Correct (GDScript) |
|---|---|
| `self.position` | `position` |
| `self.velocity` | `velocity` |
| `console.log(x)` | `print(x)` |
| `import scene` | `preload("res://scene.tscn")` |
| `def _ready():` | `func _ready():` |
| `let speed = 5` / `const X = 5` | `var speed = 5` / `const X = 5` (`const` exists but `let` does not) |
| `@property` | `@export` |
| `emit_signal("name")` | `signal_name.emit()` |
| `self.Sprite2D` | `$Sprite2D` |
| `new Vector2(x, y)` | `Vector2(x, y)` |
| `None` | `null` |
| `nil` | `null` |
| `switch`/`case` | `match` |
| `inherits Node2D` | `extends Node2D` |
| `base._ready()` | `super()` |
| `yield` | `await` |
| `push()` / `.length` | `append()` / `.size()` |
| `.isEmpty()` | `.is_empty()` |
| `move_and_slide(velocity)` | `move_and_slide()` (reads `velocity` property, Godot 4) |

### Additional Rules

- **No `self.` prefix needed.** GDScript does not require `self` to access instance members. Just use the name directly. `self` exists but is almost never needed.
- **No `import` / `require` / `using`.** Use `preload("res://path.tscn")` or `load("res://path.tscn")` for runtime loading.
- **No `new` keyword for built-in types.** `Vector2(1, 2)`, `Color(1, 0, 0)`, `Rect2(0, 0, 100, 100)`.
- **`new()` IS used for class instances.** `var mat = ParticleProcessMaterial.new()`, `var shape = CircleShape2D.new()`.
- **Indentation uses TABS**, not spaces. The parser enforces this.
- **No semicolons.** One statement per line.
- **String formatting:** `"Score: %d" % score` or `"Hello %s" % [name]`. Multi-value: `"(%d, %d)" % [x, y]`.
- **`true` / `false`** -- lowercase, same as Python.
- **Type checking:** `if node is CharacterBody2D:` (not `isinstance()`).
- **Ternary:** `var x = a if condition else b`
- **`for` loops:** `for i in range(10)`, `for item in array`, `for key in dictionary`.
- **Arrays:** `var arr = [1, 2, 3]` -- methods: `append()`, `size()`, `is_empty()`, `remove_at()`, `find()`, `has()`, `pop_back()`, `pop_front()`.
- **Dictionaries:** `var d = {"key": value}` -- methods: `has()`, `keys()`, `values()`, `size()`, `erase()`, `get()`, `merge()`.
- **`class_name MyClass`** on line 2 (after `extends`) registers the class globally. No need to preload it.
- **`@tool`** makes the script run in the Godot editor.

---

## 6. Web Export Considerations

```gdscript
# Detect web platform
if OS.has_feature("web"):
	# Web-specific logic

# Browser interaction
JavaScriptBridge.eval("document.title = 'My Game'")
JavaScriptBridge.eval("window.alert('Hello from Godot')")
var result = JavaScriptBridge.eval("navigator.userAgent")

# Download a file to user's computer
JavaScriptBridge.download_buffer(data, "save.dat")
```

Web export constraints:
- **Audio** requires user interaction (click/tap) before playing. Queue audio to start on first input event.
- **File system** is virtual (IndexedDB-backed). `user://` works but `res://` is read-only and baked into the export.
- **Threading** is limited. `Thread` class works only with `SharedArrayBuffer` (requires specific HTTP headers: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`).
- **Clipboard:** Use `JavaScriptBridge.eval()` to access `navigator.clipboard`.
- **`OS.has_feature("web")`** is the reliable platform check. Do not check `OS.get_name()` for "HTML5" (Godot 3 pattern).
