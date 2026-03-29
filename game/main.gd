extends Node2D


func _ready() -> void:
	if OS.has_feature("web"):
		_setup_javascript_bridge()


func _setup_javascript_bridge() -> void:
	var callback := JavaScriptBridge.create_callback(_on_get_game_state)
	var window := JavaScriptBridge.get_interface("window")
	window.agentJamGetState = callback
	# Also set initial state directly
	JavaScriptBridge.eval("window.agentJamState = { status: 'running', scene: 'main' };")


func _on_get_game_state(_args: Array) -> Variant:
	return get_game_state()


func get_game_state() -> Dictionary:
	return {
		"status": "running",
		"scene": "main",
	}
