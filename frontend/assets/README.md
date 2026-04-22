# Runtime Asset Drop Zones

Use this tree for content that should plug into the live runtime without touching legacy files.

Accepted primary formats:

- characters: `.glb`, `.gltf`, `.fbx`
- animations: `.glb`, `.gltf`, `.fbx`, `.bvh`
- environment and props: `.glb`, `.gltf`, `.fbx`, `.obj`
- materials: `.png`, `.jpg`, `.jpeg`, `.exr`
- lighting: `.hdr`, `.exr`
- audio hooks: `.wav`, `.mp3`, `.ogg`

Recommended naming:

- `role_variant_source.glb`
- `state_clip_rig.fbx`
- `zone_theme_hdri.hdr`
- `material_surface_maptype.png`

- `characters/source`: imported GLB/GLTF/FBX character files
- `characters/processed`: optimized runtime-ready characters
- `characters/rigs`: rig metadata or exported skeleton references
- `characters/variants`: alternate outfit or disguise variants
- `animations/source`: raw animation clips
- `animations/retargeted`: clips normalized for runtime rigs
- `animations/state-clips`: curated gameplay-ready clip sets
- `environment/kits`: modular room/building kits
- `environment/modules`: individual reusable pieces
- `environment/assembled`: authored room/prefab compositions
- `props/hero`: large focal props
- `props/filler`: repeated dressing props
- `props/interactive`: interactable stealth props
- `materials/tileables`: base tile textures
- `materials/decals`: signs, labels, trims, stains
- `materials/instances`: authored runtime material sets
- `lighting/hdris`: HDRI maps
- `lighting/profiles`: authored lighting metadata
- `lighting/presets`: room/zone lighting presets
- `audio/ambient`, `audio/ui`, `audio/foley`: presentation hooks

Current status:

- the runtime-facing registry and metadata are active
- no usable real content assets have been discovered locally yet in the approved scan locations
- drop new assets into these folders first, then register or normalize metadata through the runtime manifest
