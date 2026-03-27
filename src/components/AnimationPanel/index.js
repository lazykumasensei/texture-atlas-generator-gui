import React, { useState, useRef, useEffect } from "react"
import { Button, Upload, Space, Input, List, Card, Typography, message, Tag, Modal, InputNumber, Select, Divider } from "antd"
import { UploadOutlined, DownloadOutlined, PlusOutlined, DeleteOutlined, SettingOutlined, EyeOutlined, EyeInvisibleOutlined, EditOutlined, CopyOutlined } from "@ant-design/icons"
import styles from "./style.css"

const { Text, Title } = Typography
const { Option } = Select

const AnimationPanel = () => {
    const [atlasImage, setAtlasImage] = useState(null)
    const [sprites, setSprites] = useState([])
    const [compositeSprites, setCompositeSprites] = useState([])
    const [animations, setAnimations] = useState([])
    const [currentAnimName, setCurrentAnimName] = useState("")
    const [imgElement, setImgElement] = useState(null)
    const [selectedSprite, setSelectedSprite] = useState(null)
    const [playingAnimIdx, setPlayingAnimIdx] = useState(-1)
    const [currentFrameIdx, setCurrentFrameIdx] = useState(0)
    
    // Composite Creator State
    const [isCompositeModalVisible, setIsCompositeModalVisible] = useState(false)
    const [compName, setCompName] = useState("")
    const [compBase, setCompBase] = useState(null)
    const [compLayers, setCompLayers] = useState([])
    const [isMaskEnabled, setIsMaskEnabled] = useState(false)
    const [maskColor, setMaskColor] = useState("#ff00ff") // Default magenta
    const [compZoom, setCompZoom] = useState(1)
    const [compShowGrid, setCompShowGrid] = useState(false)
    const [editTargetName, setEditTargetName] = useState(null)
    const [selectedAnimIdx, setSelectedAnimIdx] = useState(-1)
    const [selectedFrameIdx, setSelectedFrameIdx] = useState(-1)
    const [atlasXmlName, setAtlasXmlName] = useState("")

    const previewCanvasRef = useRef(null)
    const playbackCanvasRef = useRef(null)
    const playbackTimerRef = useRef(null)

    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 }
    }

    const getSprite = (name) => {
        return sprites.find(s => s.name === name) || compositeSprites.find(s => s.name === name)
    }

    const drawSpriteRecursive = (ctx, sprite, offsetX, offsetY, scale, img, globalMaskEnabled, globalMaskColor) => {
        if (!sprite || !img) return
        if (sprite.isComposite) {
            const base = getSprite(sprite.baseSpriteName)
            drawSpriteRecursive(ctx, base, offsetX, offsetY, scale, img, sprite.isMaskEnabled, sprite.maskColor)
            sprite.layers.forEach(layer => {
                if (layer.visible === false) return
                const ls = getSprite(layer.spriteName)
                ctx.save()
                ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1
                drawSpriteRecursive(ctx, ls, offsetX + layer.x * scale, offsetY + layer.y * scale, scale, img, sprite.isMaskEnabled, sprite.maskColor)
                ctx.restore()
            })
        } else {
            if (globalMaskEnabled && globalMaskColor) {
                const tempCanvas = document.createElement("canvas")
                tempCanvas.width = sprite.w
                tempCanvas.height = sprite.h
                const tCtx = tempCanvas.getContext("2d")
                tCtx.drawImage(img, sprite.x, sprite.y, sprite.w, sprite.h, 0, 0, sprite.w, sprite.h)
                
                const imageData = tCtx.getImageData(0, 0, sprite.w, sprite.h)
                const data = imageData.data
                const m = hexToRgb(globalMaskColor)
                for (let i = 0; i < data.length; i += 4) {
                    const dr = Math.abs(data[i] - m.r)
                    const dg = Math.abs(data[i+1] - m.g)
                    const db = Math.abs(data[i+2] - m.b)
                    if (dr < 5 && dg < 5 && db < 5) {
                        data[i+3] = 0
                    }
                }
                tCtx.putImageData(imageData, 0, 0)
                ctx.drawImage(tempCanvas, 0, 0, sprite.w, sprite.h, offsetX, offsetY, sprite.w * scale, sprite.h * scale)
            } else {
                ctx.drawImage(img, sprite.x, sprite.y, sprite.w, sprite.h, offsetX, offsetY, sprite.w * scale, sprite.h * scale)
            }
        }
    }

    const getSpriteBounds = (sprite) => {
        if (!sprite) return { w: 0, h: 0, minX: 0, minY: 0 }
        if (!sprite.isComposite) return { w: sprite.w || 0, h: sprite.h || 0, minX: 0, minY: 0 }
        
        const base = getSprite(sprite.baseSpriteName)
        let minX = 0, minY = 0, maxX = base ? base.w : 0, maxY = base ? base.h : 0
        
        sprite.layers.forEach(layer => {
            if (layer.visible === false) return
            const ls = getSprite(layer.spriteName)
            if (ls) {
                const lb = getSpriteBounds(ls)
                minX = Math.min(minX, layer.x + lb.minX)
                minY = Math.min(minY, layer.y + lb.minY)
                maxX = Math.max(maxX, layer.x + lb.minX + lb.w)
                maxY = Math.max(maxY, layer.y + lb.minY + lb.h)
            }
        })
        return { w: maxX - minX, h: maxY - minY, minX, minY }
    }

    // Sprite Preview Logic
    useEffect(() => {
        if (selectedSprite && imgElement && previewCanvasRef.current) {
            const canvas = previewCanvasRef.current
            const ctx = canvas.getContext("2d")
            const { w, h } = getSpriteBounds(selectedSprite)
            
            const MAX_SIZE = 256
            const scale = Math.min(MAX_SIZE / w, MAX_SIZE / h, 1)
            const targetWidth = w * scale
            const targetHeight = h * scale

            canvas.width = targetWidth
            canvas.height = targetHeight
            ctx.clearRect(0, 0, targetWidth, targetHeight)
            drawSpriteRecursive(ctx, selectedSprite, 0, 0, scale, imgElement)
        }
    }, [selectedSprite, imgElement, compositeSprites])

    // Animation Playback Logic
    useEffect(() => {
        if (playingAnimIdx === -1 || !imgElement || !playbackCanvasRef.current) return
        const anim = animations[playingAnimIdx]
        if (!anim || anim.frames.length === 0) return

        const frame = anim.frames[currentFrameIdx]
        const delay = (frame && frame.duration) || anim.frameDuration || 200
        
        const timer = setTimeout(() => {
            setCurrentFrameIdx(prev => (prev + 1) % anim.frames.length)
        }, delay)
        
        return () => clearTimeout(timer)
    }, [playingAnimIdx, currentFrameIdx, animations, imgElement])

    useEffect(() => {
        let frameName = null
        let frameOffset = { x: 0, y: 0 }

        if (playingAnimIdx !== -1 && animations[playingAnimIdx]) {
            const anim = animations[playingAnimIdx]
            const frame = anim.frames[currentFrameIdx]
            if (frame) {
                frameName = typeof frame === 'string' ? frame : frame.spriteName
                frameOffset = { x: frame.x || 0, y: frame.y || 0 }
            }
        } else if (selectedAnimIdx !== -1 && selectedFrameIdx !== -1) {
            // Show selected frame when not playing
            const anim = animations[selectedAnimIdx]
            const frame = anim.frames[selectedFrameIdx]
            if (frame) {
                frameName = typeof frame === 'string' ? frame : frame.spriteName
                frameOffset = { x: frame.x || 0, y: frame.y || 0 }
            }
        }

        if (frameName && imgElement && playbackCanvasRef.current) {
            const sprite = getSprite(frameName)
            if (sprite) {
                const canvas = playbackCanvasRef.current
                const ctx = canvas.getContext("2d")
                const bounds = getSpriteBounds(sprite)
                const { w, h, minX, minY } = bounds

                const MAX_SIZE = 256
                const scale = Math.min(MAX_SIZE / Math.max(w, 1), MAX_SIZE / Math.max(h, 1), 1)
                
                canvas.width = MAX_SIZE
                canvas.height = MAX_SIZE
                ctx.clearRect(0, 0, MAX_SIZE, MAX_SIZE)
                
                // Base centered position + user offset
                const drawX = (MAX_SIZE - w * scale) / 2 - minX * scale + frameOffset.x * scale
                const drawY = (MAX_SIZE - h * scale) / 2 - minY * scale + frameOffset.y * scale
                
                drawSpriteRecursive(ctx, sprite, drawX, drawY, scale, imgElement)
            }
        }
    }, [currentFrameIdx, playingAnimIdx, selectedAnimIdx, selectedFrameIdx, animations, sprites, compositeSprites, imgElement])

    const togglePlayback = (idx) => {
        if (playingAnimIdx === idx) {
            setPlayingAnimIdx(-1)
            setCurrentFrameIdx(0)
        } else {
            setPlayingAnimIdx(idx)
            setCurrentFrameIdx(0)
        }
    }

    const handleImageUpload = (file) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const dataUrl = e.target.result
            setAtlasImage(dataUrl)
            const img = new Image()
            img.src = dataUrl
            img.onload = () => setImgElement(img)
        }
        reader.readAsDataURL(file)
        return false // prevent auto-upload
    }

    const handleXmlUpload = (file) => {
        setAtlasXmlName(file.name)
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const parser = new DOMParser()
                const xmlDoc = parser.parseFromString(e.target.result, "text/xml")
                
                // Parse Atlas Name if exists
                const atlasNode = xmlDoc.getElementsByTagName("atlas")[0]
                if (atlasNode) setAtlasXmlName(atlasNode.getAttribute("name"))
                
                // Parse Sprites
                const spriteNodes = xmlDoc.getElementsByTagName("sprite")
                const parsedSprites = []
                for (let i = 0; i < spriteNodes.length; i++) {
                    const node = spriteNodes[i]
                    parsedSprites.push({
                        name: node.getAttribute("n"),
                        x: parseInt(node.getAttribute("x")),
                        y: parseInt(node.getAttribute("y")),
                        w: parseInt(node.getAttribute("w")),
                        h: parseInt(node.getAttribute("h")),
                    })
                }
                if (parsedSprites.length > 0) setSprites(parsedSprites)

                // Parse Animations
                const animNodes = xmlDoc.getElementsByTagName("animation")
                const parsedAnims = []
                for (let i = 0; i < animNodes.length; i++) {
                    const node = animNodes[i]
                    const frames = []
                    const frameNodes = node.getElementsByTagName("frame")
                    for (let j = 0; j < frameNodes.length; j++) {
                        const fn = frameNodes[j]
                        frames.push({
                            spriteName: fn.getAttribute("n"),
                            x: parseInt(fn.getAttribute("x")) || 0,
                            y: parseInt(fn.getAttribute("y")) || 0
                        })
                    }
                    parsedAnims.push({
                        name: node.getAttribute("name"),
                        totalDuration: parseInt(node.getAttribute("totalDuration")) || 1000,
                        frameDuration: parseInt(node.getAttribute("frameDuration")) || 200,
                        frames
                    })
                }
                if (parsedAnims.length > 0) setAnimations(parsedAnims)

                // Parse Composite Sprites
                const compositeNodes = xmlDoc.getElementsByTagName("composite")
                const parsedComposites = []
                for (let i = 0; i < compositeNodes.length; i++) {
                    const node = compositeNodes[i]
                    const layers = []
                    const layerNodes = node.getElementsByTagName("layer")
                    for (let j = 0; j < layerNodes.length; j++) {
                        const ln = layerNodes[j]
                        layers.push({
                            spriteName: ln.getAttribute("n"),
                            x: parseInt(ln.getAttribute("x")) || 0,
                            y: parseInt(ln.getAttribute("y")) || 0,
                            opacity: parseFloat(ln.getAttribute("opacity")) || 1,
                            visible: ln.getAttribute("visible") !== "false"
                        })
                    }
                    parsedComposites.push({
                        name: node.getAttribute("name"),
                        isComposite: true,
                        baseSpriteName: node.getAttribute("base"),
                        isMaskEnabled: node.getAttribute("maskEnabled") === "true",
                        maskColor: node.getAttribute("maskColor") || "#ff00ff",
                        layers
                    })
                }
                if (parsedComposites.length > 0) setCompositeSprites(parsedComposites)

                message.success("Data loaded from XML.")
            } catch (err) {
                message.error("Failed to parse XML: " + err.message)
            }
        }
        reader.readAsText(file)
        return false
    }

    const createAnimation = () => {
        if (!currentAnimName) {
            message.warning("Please enter an animation name.")
            return
        }
        if (animations.some(a => a.name === currentAnimName)) {
            message.warning("Animation name already exists.")
            return
        }
        setAnimations([...animations, { 
            name: currentAnimName, 
            frames: [], 
            totalDuration: 1000, 
            frameDuration: 200 
        }])
        setCurrentAnimName("")
    }

    const updateAnimTiming = (idx, field, value) => {
        const newAnims = [...animations]
        const anim = newAnims[idx]
        if (field === "frameDuration") {
            anim.frameDuration = value
            anim.frames.forEach(f => f.duration = value)
            anim.totalDuration = value * anim.frames.length
        } else {
            anim.totalDuration = value
            const numFrames = anim.frames.length || 1
            anim.frameDuration = Math.round(value / numFrames)
        }
        setAnimations(newAnims)
    }

    const addFrameToAnim = (animIndex, spriteName) => {
        const newAnims = [...animations]
        const anim = newAnims[animIndex]
        anim.frames.push({ spriteName, x: 0, y: 0, duration: anim.frameDuration })
        anim.totalDuration = anim.frames.reduce((sum, f) => sum + (f.duration || 0), 0)
        setAnimations(newAnims)
    }

    const removeFrameFromAnim = (animIndex, frameIndex) => {
        const newAnims = [...animations]
        const anim = newAnims[animIndex]
        anim.frames.splice(frameIndex, 1)
        anim.totalDuration = anim.frames.reduce((sum, f) => sum + (f.duration || 0), 0)
        if (selectedAnimIdx === animIndex && selectedFrameIdx === frameIndex) {
            setSelectedFrameIdx(-1)
        }
        setAnimations(newAnims)
    }

    const updateFrameOffset = (animIndex, frameIndex, field, value) => {
        const newAnims = [...animations]
        newAnims[animIndex].frames[frameIndex][field] = value
        if (field === "duration") {
            newAnims[animIndex].totalDuration = newAnims[animIndex].frames.reduce((sum, f) => sum + (f.duration || 0), 0)
        }
        setAnimations(newAnims)
    }

    const selectFrame = (animIdx, frameIdx) => {
        setSelectedAnimIdx(animIdx)
        setSelectedFrameIdx(frameIdx)
        setPlayingAnimIdx(-1) 
    }

    const saveComposite = () => {
        if (!compName || !compBase) {
            message.warning("Please provide a name and a base sprite.")
            return
        }
        const newComp = {
            name: compName,
            isComposite: true,
            baseSpriteName: compBase,
            layers: compLayers,
            isMaskEnabled,
            maskColor
        }

        if (editTargetName) {
            setCompositeSprites(compositeSprites.map(s => s.name === editTargetName ? newComp : s))
            message.success(`Composite sprite '${compName}' updated.`)
        } else {
            setCompositeSprites([...compositeSprites, newComp])
            message.success(`Composite sprite '${compName}' created.`)
        }

        setIsCompositeModalVisible(false)
        setCompName("")
        setCompBase(null)
        setCompLayers([])
        setIsMaskEnabled(false)
        setMaskColor("#ff00ff")
        setEditTargetName(null)
    }

    const openCreateModal = () => {
        setEditTargetName(null)
        setCompName("")
        setCompBase(sprites[0]?.name)
        setCompLayers([])
        setIsMaskEnabled(false)
        setMaskColor("#ff00ff")
        setIsCompositeModalVisible(true)
    }

    const handleEditComposite = (comp) => {
        setEditTargetName(comp.name)
        setCompName(comp.name)
        setCompBase(comp.baseSpriteName)
        setCompLayers([...comp.layers])
        setIsMaskEnabled(comp.isMaskEnabled || false)
        setMaskColor(comp.maskColor || "#ff00ff")
        setIsCompositeModalVisible(true)
    }

    const handleCopyComposite = (comp) => {
        const newName = `${comp.name}_copy`
        const newComp = {
            ...comp,
            name: newName
        }
        setCompositeSprites([...compositeSprites, newComp])
        message.success(`Composite sprite '${newName}' created by copy.`)
    }

    const addLayer = () => {
        setCompLayers([...compLayers, { 
            spriteName: sprites[0]?.name, 
            x: 0, 
            y: 0, 
            opacity: 1, 
            visible: true 
        }])
    }

    const removeLayer = (idx) => {
        const newLayers = compLayers.filter((_, i) => i !== idx)
        setCompLayers(newLayers)
    }

    const updateLayer = (idx, field, value) => {
        const newLayers = [...compLayers]
        newLayers[idx][field] = value
        setCompLayers(newLayers)
    }

    const deleteAnimation = (index) => {
        const newAnims = [...animations]
        newAnims.splice(index, 1)
        if (playingAnimIdx === index) setPlayingAnimIdx(-1)
        setAnimations(newAnims)
    }

    const downloadAnimation = () => {
        if (animations.length === 0 && compositeSprites.length === 0) {
            message.warning("No data to export.")
            return
        }
        
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<animations>\n'
        if (atlasXmlName) {
            xmlContent += `  <atlas name="${atlasXmlName}" />\n`
        }
        animations.forEach(anim => {
            xmlContent += `  <animation name="${anim.name}" totalDuration="${anim.totalDuration}" frameDuration="${anim.frameDuration}">\n`
            anim.frames.forEach(frame => {
                const spriteName = typeof frame === 'string' ? frame : frame.spriteName
                const x = frame.x || 0
                const y = frame.y || 0
                const d = frame.duration || 200
                xmlContent += `    <frame n="${spriteName}" x="${x}" y="${y}" d="${d}" />\n`
            })
            xmlContent += `  </animation>\n`
        })
        
        if (compositeSprites.length > 0) {
            xmlContent += '  <compositeSprites>\n'
            compositeSprites.forEach(cs => {
                xmlContent += `    <composite name="${cs.name}" base="${cs.baseSpriteName}" maskEnabled="${cs.isMaskEnabled}" maskColor="${cs.maskColor}">\n`
                cs.layers.forEach(l => {
                    xmlContent += `      <layer n="${l.spriteName}" x="${l.x}" y="${l.y}" opacity="${l.opacity}" visible="${l.visible}" />\n`
                })
                xmlContent += '    </composite>\n'
            })
            xmlContent += '  </compositeSprites>\n'
        }
        xmlContent += '</animations>'

        const blob = new Blob([xmlContent], { type: "application/xml" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "animations.xml"
        a.click()
        URL.revokeObjectURL(url)
    }

    const deleteComposite = (name) => {
        setCompositeSprites(compositeSprites.filter(s => s.name !== name))
        if (selectedSprite?.name === name) setSelectedSprite(null)
    }

    const allAvailableSprites = [...sprites, ...compositeSprites]

    return (
        <div className={styles.animationPanel}>
            <Modal
                title="Create Composite Sprite"
                visible={isCompositeModalVisible}
                onOk={saveComposite}
                onCancel={() => setIsCompositeModalVisible(false)}
                width={1000}
            >
                <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ flex: 1, maxHeight: 600, overflowY: 'auto', paddingRight: 10 }}>
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                            <div>
                                <Text strong>Sprite Name</Text>
                                <Input value={compName} onChange={e => setCompName(e.target.value)} placeholder="e.g. Player_Blink" />
                            </div>
                            <div>
                                <Text strong>Base Sprite</Text>
                                <Select style={{ width: '100%' }} value={compBase} onChange={setCompBase}>
                                    {sprites.map(s => <Option key={s.name} value={s.name}>{s.name}</Option>)}
                                </Select>
                            </div>
                            
                            <Divider>Mask Color (Make Transparent)</Divider>
                            <Space align="center">
                                <input 
                                    type="checkbox" 
                                    checked={isMaskEnabled} 
                                    onChange={e => setIsMaskEnabled(e.target.checked)} 
                                    style={{ width: 18, height: 18 }}
                                />
                                <Text>Enable Mask</Text>
                                <input 
                                    type="color" 
                                    value={maskColor} 
                                    onChange={e => setMaskColor(e.target.value)}
                                    disabled={!isMaskEnabled}
                                    style={{ width: 50, border: 'none', background: 'none' }}
                                />
                                <Input 
                                    size="small"
                                    value={maskColor} 
                                    onChange={e => setMaskColor(e.target.value)}
                                    disabled={!isMaskEnabled}
                                    style={{ width: 80 }}
                                />
                            </Space>

                            <Divider>Layers (Overlays) - Drag in Preview to Position</Divider>
                            {compLayers.map((layer, idx) => (
                                <Card 
                                    size="small" 
                                    key={idx} 
                                    style={{ marginBottom: 10, borderLeft: '4px solid #1890ff', opacity: layer.visible ? 1 : 0.6 }}
                                    extra={
                                        <Space>
                                            <Button 
                                                type={layer.visible ? "primary" : "default"} 
                                                size="small"
                                                icon={layer.visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                                                onClick={() => updateLayer(idx, "visible", !layer.visible)}
                                            />
                                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeLayer(idx)} />
                                        </Space>
                                    }
                                >
                                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                                        <Space>
                                            <Select 
                                                style={{ width: 150 }} 
                                                value={layer.spriteName} 
                                                onChange={val => updateLayer(idx, "spriteName", val)}
                                            >
                                                {sprites.map(s => <Option key={s.name} value={s.name}>{s.name}</Option>)}
                                            </Select>
                                            <Text>X:</Text>
                                            <InputNumber size="small" style={{ width: 60 }} value={layer.x} onChange={val => updateLayer(idx, "x", val)} />
                                            <Text>Y:</Text>
                                            <InputNumber size="small" style={{ width: 60 }} value={layer.y} onChange={val => updateLayer(idx, "y", val)} />
                                        </Space>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Text type="secondary" style={{ fontSize: 12 }}>Opacity</Text>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="1" 
                                                step="0.05" 
                                                value={layer.opacity} 
                                                onChange={e => updateLayer(idx, "opacity", parseFloat(e.target.value))}
                                                style={{ flex: 1 }}
                                            />
                                            <Text style={{ fontSize: 12, width: 35 }}>{Math.round(layer.opacity * 100)}%</Text>
                                        </div>
                                    </Space>
                                </Card>
                            ))}
                            <Button type="dashed" onClick={addLayer} block icon={<PlusOutlined />}>Add Layer</Button>
                        </Space>
                    </div>
                    <div style={{ width: 400, background: '#fafafa', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                        <Title level={5}>Live Preview (Drag Layers)</Title>
                        
                        <div style={{ marginBottom: 15, background: '#fff', padding: '10px 15px', borderRadius: 6, border: '1px solid #eee' }}>
                            <Space direction="horizontal" style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Space>
                                    <Text size="small">Zoom:</Text>
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="8" 
                                        step="1" 
                                        value={compZoom} 
                                        onChange={e => setCompZoom(parseInt(e.target.value))} 
                                        style={{ width: 80 }}
                                    />
                                    <Text strong>{compZoom}x</Text>
                                </Space>
                                <Space>
                                    <input 
                                        type="checkbox" 
                                        checked={compShowGrid} 
                                        onChange={e => setCompShowGrid(e.target.checked)} 
                                        style={{ width: 16, height: 16 }}
                                    />
                                    <Text size="small">Show Grid</Text>
                                </Space>
                            </Space>
                        </div>

                        <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #eee', background: '#fff', cursor: 'move', position: 'relative', overflow: 'auto' }}>
                            <CompositePreview 
                                baseName={compBase} 
                                layers={compLayers} 
                                getSprite={getSprite}
                                img={imgElement}
                                getSpriteBounds={getSpriteBounds}
                                drawSpriteRecursive={drawSpriteRecursive}
                                onUpdateLayer={updateLayer}
                                isMaskEnabled={isMaskEnabled}
                                maskColor={maskColor}
                                zoom={compZoom}
                                showGrid={compShowGrid}
                            />
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>Drag layers to move. Use Zoom for precision. Grid shows 1px units.</Text>
                        </div>
                    </div>
                </div>
            </Modal>

            <div className={styles.uploadSection}>
                <Space direction="vertical">
                    <Text strong>Step 1: Upload Atlas Texture & XML</Text>
                    <Space>
                        <Upload beforeUpload={handleImageUpload} showUploadList={false} accept="image/*">
                            <Button icon={<UploadOutlined />}>Upload Texture (PNG/JPG)</Button>
                        </Upload>
                        <Upload beforeUpload={handleXmlUpload} showUploadList={false} accept=".xml">
                            <Button icon={<UploadOutlined />}>Upload Data (XML)</Button>
                        </Upload>
                    </Space>
                </Space>
                {atlasImage && <img src={atlasImage} style={{ maxHeight: 100, border: '1px solid #ddd' }} />}
            </div>

            <div className={styles.contentSection}>
                <div className={styles.spriteListContainer}>
                    <div className={styles.previewHeader}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <Title level={5} style={{ margin: 0 }}>Available Sprites</Title>
                            <Button size="small" icon={<SettingOutlined />} onClick={openCreateModal}>
                                Create Composite
                            </Button>
                        </div>
                    </div>
                    
                    <div className={styles.scrollableList}>
                        <List
                            dataSource={allAvailableSprites}
                            renderItem={item => (
                                <div 
                                    className={`${styles.spriteItem} ${selectedSprite?.name === item.name ? styles.spriteItemActive : ''}`}
                                    onClick={() => setSelectedSprite(item)}
                                >
                                    <Text>{item.name}</Text>
                                    <Space onClick={e => e.stopPropagation()}>
                                        <Text type="secondary">
                                            {item.isComposite ? "Composite" : `${item.w}x${item.h}`}
                                        </Text>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {animations.map((anim, idx) => (
                                                <Button 
                                                    key={idx} 
                                                    size="small" 
                                                    type="dashed"
                                                    onClick={() => addFrameToAnim(idx, item.name)}
                                                >
                                                    + {anim.name}
                                                </Button>
                                            ))}
                                            {item.isComposite && (
                                                <Space>
                                                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleEditComposite(item)} />
                                                    <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => handleCopyComposite(item)} />
                                                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => deleteComposite(item.name)} />
                                                </Space>
                                            )}
                                        </div>
                                    </Space>
                                </div>
                            )}
                        />
                    </div>
                </div>

                <div className={styles.animationList}>
                    {/* New Preview & Playback Section */}
                    <div className={styles.previewContainer}>
                        <div className={styles.previewBox}>
                            <Title level={5}>Sprite Preview</Title>
                            <div className={styles.canvasWrapper}>
                                {selectedSprite ? (
                                    <canvas ref={previewCanvasRef} className={styles.previewCanvas} />
                                ) : (
                                    <Text type="secondary">Select a sprite to preview</Text>
                                )}
                            </div>
                        </div>
                        <div className={styles.previewBox}>
                            <Title level={5}>Animation Playback</Title>
                            <div className={styles.canvasWrapper}>
                                {(playingAnimIdx !== -1 || (selectedAnimIdx !== -1 && selectedFrameIdx !== -1)) ? (
                                    <div style={{ textAlign: 'center' }}>
                                        <canvas ref={playbackCanvasRef} className={styles.previewCanvas} />
                                        <div style={{ marginTop: 5 }}>
                                            {playingAnimIdx !== -1 ? (
                                                <>
                                                    <Text strong>{animations[playingAnimIdx].name}</Text>
                                                    <Text type="secondary"> (Frame {currentFrameIdx + 1}/{animations[playingAnimIdx].frames.length})</Text>
                                                </>
                                            ) : (
                                                <>
                                                    <Text strong>{animations[selectedAnimIdx].name}</Text>
                                                    <Text type="secondary"> (Selected Frame {selectedFrameIdx + 1})</Text>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <Text type="secondary">Play an animation or select a frame to see it here</Text>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={styles.animationControls}>
                        <Space>
                            <Input 
                                placeholder="New animation name" 
                                value={currentAnimName} 
                                onChange={e => setCurrentAnimName(e.target.value)}
                                onPressEnter={createAnimation}
                            />
                            <Button type="primary" icon={<PlusOutlined />} onClick={createAnimation}>Create Animation</Button>
                            <Button type="primary" danger icon={<DownloadOutlined />} onClick={downloadAnimation} disabled={animations.length === 0}>
                                Download XML
                            </Button>
                        </Space>
                    </div>

                    <div className={styles.scrollableAnimations}>
                        {animations.map((anim, animIdx) => (
                            <Card 
                                key={animIdx} 
                                title={anim.name} 
                                size="small"
                                extra={
                                    <Space shape="round">
                                        <Button 
                                            type={playingAnimIdx === animIdx ? "primary" : "default"} 
                                            icon={playingAnimIdx === animIdx ? <DeleteOutlined /> : <PlusOutlined />} 
                                            onClick={() => togglePlayback(animIdx)}
                                            disabled={anim.frames.length === 0}
                                        >
                                            {playingAnimIdx === animIdx ? "Stop" : "Play"}
                                        </Button>
                                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => deleteAnimation(animIdx)} />
                                    </Space>
                                }
                                className={styles.animationCard}
                            >
                                <div style={{ marginBottom: 10 }}>
                                    <Space split={<Text type="secondary">|</Text>}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Text type="secondary" size="small">Total (ms)</Text>
                                            <Input 
                                                type="number" 
                                                size="small" 
                                                style={{ width: 80 }} 
                                                value={anim.totalDuration} 
                                                onChange={e => updateAnimTiming(animIdx, "totalDuration", parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Text type="secondary" size="small">Per Frame (ms)</Text>
                                            <Input 
                                                type="number" 
                                                size="small" 
                                                style={{ width: 80 }} 
                                                value={anim.frameDuration} 
                                                onChange={e => updateAnimTiming(animIdx, "frameDuration", parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                    </Space>
                                </div>
                                <div className={styles.framesVerticalContainer}>
                                    {anim.frames.map((frame, frameIdx) => (
                                        <div 
                                            key={frameIdx} 
                                            className={`${styles.frameItem} ${selectedAnimIdx === animIdx && selectedFrameIdx === frameIdx ? styles.frameItemActive : ''}`}
                                            onClick={() => selectFrame(animIdx, frameIdx)}
                                        >
                                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                <Space>
                                                    <Text strong style={{ minWidth: 20 }}>{frameIdx + 1}</Text>
                                                    <Text>{typeof frame === 'string' ? frame : frame.spriteName}</Text>
                                                </Space>
                                                <Space onClick={e => e.stopPropagation()}>
                                                    <Text size="small" type="secondary">X:</Text>
                                                    <InputNumber 
                                                        size="small" 
                                                        style={{ width: 55 }} 
                                                        value={frame.x || 0} 
                                                        onChange={val => updateFrameOffset(animIdx, frameIdx, "x", val)} 
                                                    />
                                                    <Text size="small" type="secondary">Y:</Text>
                                                    <InputNumber 
                                                        size="small" 
                                                        style={{ width: 55 }} 
                                                        value={frame.y || 0} 
                                                        onChange={val => updateFrameOffset(animIdx, frameIdx, "y", val)} 
                                                    />
                                                    <Text size="small" type="secondary">Dur:</Text>
                                                    <InputNumber 
                                                        size="small" 
                                                        style={{ width: 60 }} 
                                                        value={frame.duration || 0} 
                                                        onChange={val => updateFrameOffset(animIdx, frameIdx, "duration", val)} 
                                                    />
                                                    <Button 
                                                        size="small" 
                                                        type="text" 
                                                        danger 
                                                        icon={<DeleteOutlined />} 
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            removeFrameFromAnim(animIdx, frameIdx)
                                                        }} 
                                                    />
                                                </Space>
                                            </Space>
                                        </div>
                                    ))}
                                    {anim.frames.length === 0 && <Text type="secondary">No frames added yet. Click '+' on a sprite to add.</Text>}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

const CompositePreview = ({ baseName, layers, getSprite, img, getSpriteBounds, drawSpriteRecursive, onUpdateLayer, isMaskEnabled, maskColor, zoom = 1, showGrid = false }) => {
    const canvasRef = useRef(null)
    const [draggingIdx, setDraggingIdx] = useState(-1)
    const [selectedLayerIdx, setSelectedLayerIdx] = useState(-1)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const [baseScale, setBaseScale] = useState(1)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !img) return
        const ctx = canvas.getContext("2d")
        
        // Logical composite for preview
        const tempSprite = {
            isComposite: true,
            baseSpriteName: baseName,
            layers: layers,
            isMaskEnabled,
            maskColor
        }
        
        const { w, h, minX, minY } = getSpriteBounds(tempSprite)
        if (w === 0 || h === 0) return

        const MAX_SIZE = 256
        const s = Math.min(MAX_SIZE / Math.max(w, 1), MAX_SIZE / Math.max(h, 1), 1)
        setBaseScale(s)
        
        const finalScale = s * zoom
        canvas.width = w * finalScale
        canvas.height = h * finalScale
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        // Offset drawing by -minX, -minY to keep everything in view
        drawSpriteRecursive(ctx, tempSprite, -minX * finalScale, -minY * finalScale, finalScale, img, isMaskEnabled, maskColor)

        if (selectedLayerIdx !== -1 && layers[selectedLayerIdx]) {
            const layer = layers[selectedLayerIdx]
            const ls = getSprite(layer.spriteName)
            if (ls && layer.visible !== false) {
                ctx.strokeStyle = "red"
                ctx.lineWidth = 2
                ctx.strokeRect((layer.x - minX) * finalScale, (layer.y - minY) * finalScale, ls.w * finalScale, ls.h * finalScale)
            }
        }

        if (showGrid) {
            // ... grid drawing ...
            ctx.strokeStyle = "rgba(0, 0, 0, 0.1)"
            ctx.lineWidth = 0.5
            ctx.beginPath()
            for (let x = 0; x <= w; x++) {
                ctx.moveTo(x * finalScale, 0)
                ctx.lineTo(x * finalScale, h * finalScale)
            }
            for (let y = 0; y <= h; y++) {
                ctx.moveTo(0, y * finalScale)
                ctx.lineTo(w * finalScale, y * finalScale)
            }
            ctx.stroke()

            const originX = -minX * finalScale
            const originY = -minY * finalScale
            ctx.strokeStyle = "rgba(0, 100, 255, 0.5)"
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(originX, 0)
            ctx.lineTo(originX, h * finalScale)
            ctx.moveTo(0, originY)
            ctx.lineTo(w * finalScale, originY)
            ctx.stroke()
        }
    }, [baseName, layers, img, getSprite, getSpriteBounds, drawSpriteRecursive, isMaskEnabled, maskColor, zoom, showGrid, selectedLayerIdx])

    const handleMouseDown = (e) => {
        const rect = canvasRef.current.getBoundingClientRect()
        const finalScale = baseScale * zoom
        const { minX, minY } = getSpriteBounds({ isComposite: true, baseSpriteName: baseName, layers })
        
        const mouseX = (e.clientX - rect.left) / finalScale + minX
        const mouseY = (e.clientY - rect.top) / finalScale + minY
        
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i]
            if (layer.visible === false) continue
            const ls = getSprite(layer.spriteName)
            if (ls && mouseX >= layer.x && mouseX <= layer.x + ls.w && mouseY >= layer.y && mouseY <= layer.y + ls.h) {
                setDraggingIdx(i)
                setSelectedLayerIdx(i)
                setDragOffset({ x: mouseX - layer.x, y: mouseY - layer.y })
                return
            }
        }
        setSelectedLayerIdx(-1)
    }

    const handleMouseMove = (e) => {
        if (draggingIdx === -1) return
        const rect = canvasRef.current.getBoundingClientRect()
        const finalScale = baseScale * zoom
        const { minX, minY } = getSpriteBounds({ isComposite: true, baseSpriteName: baseName, layers })
        
        const mouseX = (e.clientX - rect.left) / finalScale + minX
        const mouseY = (e.clientY - rect.top) / finalScale + minY
        
        onUpdateLayer(draggingIdx, "x", Math.round(mouseX - dragOffset.x))
        onUpdateLayer(draggingIdx, "y", Math.round(mouseY - dragOffset.y))
    }

    const handleMouseUp = () => setDraggingIdx(-1)

    return (
        <canvas 
            ref={canvasRef} 
            onMouseDown={handleMouseDown} 
            onMouseMove={handleMouseMove} 
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ border: '1px solid #ddd' }} 
        />
    )
}

export default AnimationPanel
