import React, { useState, useRef, useEffect } from 'react'
import { 
    Typography, Button, List, Space, Input, InputNumber, 
    Card, Upload, message, Divider, Select, Tooltip, Tag,
    Collapse, Slider, Checkbox
} from 'antd'
import { 
    UploadOutlined, PlusOutlined, DeleteOutlined, 
    DownloadOutlined, DragOutlined, EyeOutlined,
    EditOutlined, BorderOutlined
} from '@ant-design/icons'
import { animate } from 'animejs'
import styles from './style.css'

const { Title, Text } = Typography
const { Panel } = Collapse
const { Option } = Select

const ScenePanel = () => {
    const [resources, setResources] = useState([])
    const [sceneSettings, setSceneSettings] = useState({ width: 1280, height: 720, bgColor: "#ffffff" })
    const [windowSettings, setWindowSettings] = useState({ width: 800, height: 600, show: true })
    const [elements, setElements] = useState([])
    const [selectedElementId, setSelectedElementId] = useState(null)
    const [zoom, setZoom] = useState(1)
    const [isAutoFit, setIsAutoFit] = useState(true)
    const [manualZoom, setManualZoom] = useState(1)
    
    // Resource Upload State
    const [uploadName, setUploadName] = useState("")
    const [tempFiles, setTempFiles] = useState({ img: null, xml: null, anim: null })

    const canvasRef = useRef(null)
    const viewportRef = useRef(null)

    // Responsive Scaling
    useEffect(() => {
        if (!viewportRef.current || !isAutoFit) return
        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect
            const paddingW = 40
            const paddingH = 40
            const canvasW = sceneSettings.width
            const canvasH = sceneSettings.height
            const availableW = Math.max(width - paddingW, 100)
            const availableH = Math.max(height - paddingH, 100)
            
            // Calculate zoom to fit
            const zW = availableW / canvasW
            const zH = availableH / canvasH
            const newZoom = Math.min(zW, zH, 4)
            setZoom(newZoom)
            setManualZoom(newZoom)
        })
        observer.observe(viewportRef.current)
        return () => observer.disconnect()
    }, [sceneSettings.width, sceneSettings.height, isAutoFit])

    // Effective zoom used for rendering and interactions
    const effectiveZoom = isAutoFit ? zoom : manualZoom

    // Helper: Draw sprite (similar to AnimationPanel but with resource context)
    const drawSpriteRecursive = (ctx, sprite, x, y, scale, img, allSprites, allComposites) => {
        if (!sprite || !img) return

        if (sprite.isComposite) {
            const baseSprite = allSprites.find(s => s.name === sprite.baseSpriteName) || 
                             allComposites.find(s => s.name === sprite.baseSpriteName)
            if (baseSprite) {
                drawSpriteRecursive(ctx, baseSprite, x, y, scale, img, allSprites, allComposites)
            }
            if (sprite.layers) {
                sprite.layers.forEach(layer => {
                    if (!layer.visible) return
                    const layerSprite = allSprites.find(s => s.name === layer.spriteName) || 
                                      allComposites.find(s => s.name === layer.spriteName)
                    if (layerSprite) {
                        ctx.globalAlpha = layer.opacity || 1
                        drawSpriteRecursive(ctx, layerSprite, x + layer.x * scale, y + layer.y * scale, scale, img, allSprites, allComposites)
                        ctx.globalAlpha = 1
                    }
                })
            }
            return
        }

        ctx.drawImage(
            img,
            sprite.x, sprite.y, sprite.w, sprite.h,
            x, y, sprite.w * scale, sprite.h * scale
        )
    }

    const handleUploadResource = () => {
        if (!uploadName || !tempFiles.img || !tempFiles.xml) {
            message.warning("Please provide a name, texture image, and atlas XML.")
            return
        }

        const readerImg = new FileReader()
        readerImg.onload = (eImg) => {
            const img = new Image()
            img.onload = () => {
                const readerXml = new FileReader()
                readerXml.onload = (eXml) => {
                    try {
                        const parser = new DOMParser()
                        const xmlDoc = parser.parseFromString(eXml.target.result, "text/xml")
                        const spriteNodes = xmlDoc.getElementsByTagName("sprite")
                        const sprites = []
                        for (let i = 0; i < spriteNodes.length; i++) {
                            const node = spriteNodes[i]
                            sprites.push({
                                name: node.getAttribute("n"),
                                x: parseInt(node.getAttribute("x")),
                                y: parseInt(node.getAttribute("y")),
                                w: parseInt(node.getAttribute("w")),
                                h: parseInt(node.getAttribute("h"))
                            })
                        }

                        // Animations
                        const animations = []
                        if (tempFiles.anim) {
                            const readerAnim = new FileReader()
                            readerAnim.onload = (eAnim) => {
                                const animDoc = parser.parseFromString(eAnim.target.result, "text/xml")
                                const animNodes = animDoc.getElementsByTagName("animation")
                                for (let i = 0; i < animNodes.length; i++) {
                                    const node = animNodes[i]
                                    const frames = []
                                    const frameNodes = node.getElementsByTagName("frame")
                                    for (let j = 0; j < frameNodes.length; j++) {
                                        const fn = frameNodes[j]
                                        frames.push({
                                            spriteName: fn.getAttribute("n"),
                                            x: parseInt(fn.getAttribute("x")) || 0,
                                            y: parseInt(fn.getAttribute("y")) || 0,
                                            duration: parseInt(fn.getAttribute("d")) || 200
                                        })
                                    }
                                    animations.push({
                                        name: node.getAttribute("name"),
                                        frames
                                    })
                                }
                                finishUpload(sprites, animations, img)
                            }
                            readerAnim.readAsText(tempFiles.anim)
                        } else {
                            finishUpload(sprites, [], img)
                        }

                    } catch (err) {
                        message.error("Failed to parse XML: " + err.message)
                    }
                }
                readerXml.readAsText(tempFiles.xml)
            }
            img.src = eImg.target.result
        }
        readerImg.readAsDataURL(tempFiles.img)
    }

    const finishUpload = (sprites, animations, img) => {
        setResources([...resources, {
            id: Date.now().toString(),
            name: uploadName,
            img,
            sprites,
            animations
        }])
        setUploadName("")
        setTempFiles({ img: null, xml: null, anim: null })
        message.success("Resource added successfully!")
    }

    const addElementToScene = (resId, type, itemName) => {
        const newElement = {
            id: Date.now().toString(),
            resId,
            type, // 'sprite' or 'animation'
            name: itemName,
            x: Math.round(sceneSettings.width / 2),
            y: Math.round(sceneSettings.height / 2),
            scale: 1,
            rotation: 0,
            opacity: 1,
            visible: true,
            currentFrame: 0,
            lastTick: Date.now()
        }
        setElements([...elements, newElement])
        setSelectedElementId(newElement.id)
    }

    const removeElement = (id) => {
        setElements(elements.filter(el => el.id !== id))
        if (selectedElementId === id) setSelectedElementId(null)
    }

    const updateElement = (id, field, value) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, [field]: value } : el))
    }

    const applyAnimation = (type, elId) => {
        const el = elements.find(e => e.id === elId)
        if (!el) return

        const targets = { 
            x: el.x, 
            y: el.y, 
            scale: el.scale, 
            opacity: el.opacity 
        }

        switch (type) {
            case 'bounce':
                animate(targets, {
                    y: targets.y - 60,
                    duration: 500,
                    alternate: true,
                    loop: 1, // one iteration (2 loops total with alternate)
                    easing: 'easeOutQuad',
                    onUpdate: () => updateElement(elId, 'y', Math.round(targets.y))
                })
                break
            case 'shake':
                animate(targets, {
                    x: [targets.x - 10, targets.x + 10, targets.x - 10, targets.x + 10, targets.x],
                    duration: 400,
                    easing: 'easeInOutQuad',
                    onUpdate: () => updateElement(elId, 'x', Math.round(targets.x))
                })
                break
            case 'pulse':
                animate(targets, {
                    scale: [targets.scale, targets.scale * 1.2, targets.scale],
                    duration: 400,
                    easing: 'easeInOutSine',
                    onUpdate: () => updateElement(elId, 'scale', targets.scale)
                })
                break
            case 'fade':
                animate(targets, {
                    opacity: [targets.opacity, 0.1, targets.opacity],
                    duration: 800,
                    easing: 'easeInOutSine',
                    onUpdate: () => updateElement(elId, 'opacity', targets.opacity)
                })
                break
        }
    }

    const getSpriteBounds = (sprite, allSprites, allComposites) => {
        if (!sprite) return { w: 0, h: 0, minX: 0, minY: 0 }
        if (!sprite.isComposite) return { w: sprite.w, h: sprite.h, minX: 0, minY: 0 }

        let minX = 0, minY = 0, maxX = 0, maxY = 0

        const baseSprite = allSprites.find(s => s.name === sprite.baseSpriteName) || 
                         allComposites.find(s => s.name === sprite.baseSpriteName)
        if (baseSprite) {
            const b = getSpriteBounds(baseSprite, allSprites, allComposites)
            minX = b.minX; minY = b.minY; maxX = b.w + b.minX; maxY = b.h + b.minY
        }

        if (sprite.layers) {
            sprite.layers.forEach(layer => {
                const ls = allSprites.find(s => s.name === layer.spriteName) || 
                           allComposites.find(s => s.name === layer.spriteName)
                if (ls) {
                    const b = getSpriteBounds(ls, allSprites, allComposites)
                    const lx = layer.x + b.minX; const ly = layer.y + b.minY
                    minX = Math.min(minX, lx); minY = Math.min(minY, ly)
                    maxX = Math.max(maxX, lx + b.w); maxY = Math.max(maxY, ly + b.h)
                }
            })
        }
        return { w: maxX - minX, h: maxY - minY, minX, minY }
    }

    // Animation Loop
    useEffect(() => {
        let animId
        const tick = () => {
            const now = Date.now()
            setElements(prev => prev.map(el => {
                if (el.type !== 'animation' || !el.visible) return el
                const res = resources.find(r => r.id === el.resId)
                if (!res) return el
                const anim = res.animations.find(a => a.name === el.name)
                if (!anim || anim.frames.length <= 1) return el

                const frame = anim.frames[el.currentFrame]
                const duration = frame.duration || 200
                if (now - el.lastTick >= duration) {
                    return {
                        ...el,
                        currentFrame: (el.currentFrame + 1) % anim.frames.length,
                        lastTick: now
                    }
                }
                return el
            }))
            animId = requestAnimationFrame(tick)
        }
        animId = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(animId)
    }, [resources]) // Only restart if resources change

    // Interaction State
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

    const handleMouseDown = (e) => {
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        const mouseX = (e.clientX - rect.left) / effectiveZoom
        const mouseY = (e.clientY - rect.top) / effectiveZoom

        // Hit detection from top-most layer
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i]
            if (!el.visible) continue
            const res = resources.find(r => r.id === el.resId)
            if (!res) continue

            let sprite = null
            let offsetX = 0
            let offsetY = 0

            if (el.type === 'sprite') {
                sprite = res.sprites.find(s => s.name === el.name)
            } else {
                const anim = res.animations.find(a => a.name === el.name)
                if (anim && anim.frames.length > 0) {
                    const frameIdx = el.currentFrame % anim.frames.length
                    const frame = anim.frames[frameIdx]
                    sprite = res.sprites.find(s => s.name === frame.spriteName)
                    offsetX = frame.x || 0
                    offsetY = frame.y || 0
                }
            }

            if (sprite) {
                const bounds = getSpriteBounds(sprite, res.sprites, [])
                const ex = el.x + (offsetX + bounds.minX) * el.scale
                const ey = el.y + (offsetY + bounds.minY) * el.scale
                const ew = bounds.w * el.scale
                const eh = bounds.h * el.scale

                if (mouseX >= ex && mouseX <= ex + ew && mouseY >= ey && mouseY <= ey + eh) {
                    setSelectedElementId(el.id)
                    setIsDragging(true)
                    setDragOffset({ x: mouseX - el.x, y: mouseY - el.y })
                    return
                }
            }
        }
        setSelectedElementId(null)
    }

    const handleMouseMove = (e) => {
        if (!isDragging || !selectedElementId) return
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        const mouseX = (e.clientX - rect.left) / effectiveZoom
        const mouseY = (e.clientY - rect.top) / effectiveZoom
        
        updateElement(selectedElementId, 'x', Math.round(mouseX - dragOffset.x))
        updateElement(selectedElementId, 'y', Math.round(mouseY - dragOffset.y))
    }

    const handleMouseUp = () => setIsDragging(false)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        
        ctx.fillStyle = sceneSettings.bgColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        elements.forEach(el => {
            if (!el.visible) return
            const res = resources.find(r => r.id === el.resId)
            if (!res) return

            let spriteToDraw = null
            let offsetX = 0
            let offsetY = 0

            if (el.type === 'sprite') {
                spriteToDraw = res.sprites.find(s => s.name === el.name)
            } else if (el.type === 'animation') {
                const anim = res.animations.find(a => a.name === el.name)
                if (anim && anim.frames.length > 0) {
                    const frameIdx = el.currentFrame % anim.frames.length
                    const frame = anim.frames[frameIdx]
                    spriteToDraw = res.sprites.find(s => s.name === frame.spriteName)
                    offsetX = frame.x || 0
                    offsetY = frame.y || 0
                }
            }

            if (spriteToDraw) {
                drawSpriteRecursive(ctx, spriteToDraw, el.x + offsetX * el.scale, el.y + offsetY * el.scale, el.scale, res.img, res.sprites, [])
                
                if (el.id === selectedElementId) {
                    const bounds = getSpriteBounds(spriteToDraw, res.sprites, [])
                    ctx.strokeStyle = "red"
                    ctx.lineWidth = 2
                    ctx.strokeRect(
                        el.x + (offsetX + bounds.minX) * el.scale, 
                        el.y + (offsetY + bounds.minY) * el.scale, 
                        bounds.w * el.scale, 
                        bounds.h * el.scale
                    )
                }
            }
        })

        // Draw Window Frame (Green)
        if (windowSettings.show) {
            ctx.strokeStyle = "#00ff00"
            ctx.lineWidth = 1
            const wx = (sceneSettings.width - windowSettings.width) / 2
            const wy = (sceneSettings.height - windowSettings.height) / 2
            ctx.strokeRect(wx, wy, windowSettings.width, windowSettings.height)
        }
    }, [elements, resources, sceneSettings, selectedElementId, windowSettings])

    const exportScene = () => {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<scene width="${sceneSettings.width}" height="${sceneSettings.height}">\n`
        xml += `  <resources>\n`
        resources.forEach(r => {
            xml += `    <resource name="${r.name}" />\n`
        })
        xml += `  </resources>\n`
        xml += `  <elements>\n`
        elements.forEach(el => {
            xml += `    <element res="${resources.find(r => r.id === el.resId)?.name}" type="${el.type}" name="${el.name}" x="${el.x}" y="${el.y}" scale="${el.scale}" opacity="${el.opacity}" visible="${el.visible}" />\n`
        })
        xml += `  </elements>\n</scene>`

        const blob = new Blob([xml], { type: "application/xml" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "scene.xml"
        a.click()
    }

    const selectedElement = elements.find(el => el.id === selectedElementId)

    return (
        <div className={styles.scenePanel}>
            <div className={styles.sidebar}>
                <div className={styles.section}>
                    <Title level={5}>Scene Settings</Title>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Space>
                            <Text>Canvas:</Text>
                            <InputNumber value={sceneSettings.width} onChange={v => setSceneSettings({...sceneSettings, width: v})} style={{ width: 80 }} />
                            <Text>x</Text>
                            <InputNumber value={sceneSettings.height} onChange={v => setSceneSettings({...sceneSettings, height: v})} style={{ width: 80 }} />
                        </Space>
                        <Space>
                            <Text>Window:</Text>
                            <InputNumber value={windowSettings.width} onChange={v => setWindowSettings({...windowSettings, width: v})} style={{ width: 80 }} />
                            <Text>x</Text>
                            <InputNumber value={windowSettings.height} onChange={v => setWindowSettings({...windowSettings, height: v})} style={{ width: 80 }} />
                            <Checkbox checked={windowSettings.show} onChange={e => setWindowSettings({...windowSettings, show: e.target.checked})} />
                        </Space>
                    </Space>
                </div>

                <div className={styles.section}>
                    <Title level={5}>View</Title>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Checkbox checked={isAutoFit} onChange={e => setIsAutoFit(e.target.checked)}>Auto Fit to Screen</Checkbox>
                        {!isAutoFit && (
                            <Space>
                                <Slider 
                                    min={0.1} 
                                    max={4} 
                                    step={0.01} 
                                    value={manualZoom} 
                                    onChange={setManualZoom} 
                                    style={{ width: 100 }}
                                    tooltip={{ formatter: v => `${Math.round(v * 100)}%` }}
                                />
                                <InputNumber 
                                    min={0.1} 
                                    max={4} 
                                    step={0.01} 
                                    value={manualZoom} 
                                    onChange={setManualZoom} 
                                    style={{ width: 70 }}
                                    formatter={v => `${Math.round(v * 100)}%`}
                                    parser={v => parseFloat(v) / 100}
                                />
                            </Space>
                        )}
                        <Button type="primary" block icon={<DownloadOutlined />} onClick={exportScene}>Export Scene XML</Button>
                    </Space>
                </div>

                <div className={styles.section}>
                    <Title level={5}>Import Resource</Title>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Input placeholder="Resource Set Name" value={uploadName} onChange={e => setUploadName(e.target.value)} />
                        <Space wrap>
                            <Upload beforeUpload={file => { setTempFiles({...tempFiles, img: file}); return false }} showUploadList={false}>
                                <Button size="small" icon={<UploadOutlined />} type={tempFiles.img ? "primary" : "default"}>PNG</Button>
                            </Upload>
                            <Upload beforeUpload={file => { setTempFiles({...tempFiles, xml: file}); return false }} showUploadList={false}>
                                <Button size="small" icon={<UploadOutlined />} type={tempFiles.xml ? "primary" : "default"}>Atlas XML</Button>
                            </Upload>
                            <Upload beforeUpload={file => { setTempFiles({...tempFiles, anim: file}); return false }} showUploadList={false}>
                                <Button size="small" icon={<UploadOutlined />} type={tempFiles.anim ? "primary" : "default"}>Anim XML</Button>
                            </Upload>
                            <Button size="small" type="primary" onClick={handleUploadResource}>Add</Button>
                        </Space>
                    </Space>
                </div>

                <div className={styles.resourceList}>
                    <Title level={5}>Available Resources</Title>
                    <Collapse accordion ghost>
                        {resources.map(res => (
                            <Panel header={res.name} key={res.id}>
                                <div className={styles.resSection}>
                                    <Text type="secondary">Sprites</Text>
                                    <div className={styles.itemGrid}>
                                        {res.sprites.map(s => (
                                            <Tag key={s.name} className={styles.draggableItem} onClick={() => addElementToScene(res.id, 'sprite', s.name)}>
                                                {s.name}
                                            </Tag>
                                        ))}
                                    </div>
                                </div>
                                {res.animations.length > 0 && (
                                    <div className={styles.resSection}>
                                        <Text type="secondary">Animations</Text>
                                        <div className={styles.itemGrid}>
                                            {res.animations.map(a => (
                                                <Tag color="blue" key={a.name} className={styles.draggableItem} onClick={() => addElementToScene(res.id, 'animation', a.name)}>
                                                    {a.name}
                                                </Tag>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Panel>
                        ))}
                    </Collapse>
                </div>
            </div>

            <div className={styles.viewport} ref={viewportRef}>
                <div 
                    className={styles.canvasContainer}
                    style={{ 
                        width: sceneSettings.width, 
                        height: sceneSettings.height,
                        transform: `scale(${effectiveZoom})`
                    }}
                >
                    <canvas 
                        ref={canvasRef} 
                        width={sceneSettings.width} 
                        height={sceneSettings.height}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />
                </div>
            </div>

            <div className={styles.inspector}>
                <Title level={5}>Inspector</Title>
                {selectedElement ? (
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Text strong>{selectedElement.name} ({selectedElement.type})</Text>
                        <Divider style={{ margin: '8px 0' }} />
                        <div className={styles.propRow}>
                            <Text>Position X:</Text>
                            <InputNumber value={selectedElement.x} onChange={v => updateElement(selectedElement.id, 'x', v)} />
                        </div>
                        <div className={styles.propRow}>
                            <Text>Position Y:</Text>
                            <InputNumber value={selectedElement.y} onChange={v => updateElement(selectedElement.id, 'y', v)} />
                        </div>
                        <div className={styles.propRow}>
                            <Text>Scale:</Text>
                            <InputNumber step={0.1} value={selectedElement.scale} onChange={v => updateElement(selectedElement.id, 'scale', v)} />
                        </div>
                        <div className={styles.propRow}>
                            <Text>Opacity:</Text>
                            <Slider min={0} max={1} step={0.01} value={selectedElement.opacity} onChange={v => updateElement(selectedElement.id, 'opacity', v)} style={{ flex: 1 }} />
                        </div>
                        <Space>
                            <Checkbox checked={selectedElement.visible} onChange={e => updateElement(selectedElement.id, 'visible', e.target.checked)}>Visible</Checkbox>
                            <Button danger icon={<DeleteOutlined />} onClick={() => removeElement(selectedElement.id)}>Remove</Button>
                        </Space>
                        
                        <Divider style={{ margin: '12px 0' }} />
                        <Title level={5}>Presets (anime.js)</Title>
                        <Space wrap>
                            <Button size="small" onClick={() => applyAnimation('bounce', selectedElement.id)}>Bounce</Button>
                            <Button size="small" onClick={() => applyAnimation('shake', selectedElement.id)}>Shake</Button>
                            <Button size="small" onClick={() => applyAnimation('pulse', selectedElement.id)}>Pulse</Button>
                            <Button size="small" onClick={() => applyAnimation('fade', selectedElement.id)}>Fade</Button>
                        </Space>
                    </Space>
                ) : (
                    <Text type="secondary">No element selected</Text>
                )}

                <Divider />
                <Title level={5}>Scene Layers</Title>
                <List
                    size="small"
                    dataSource={elements}
                    renderItem={el => (
                        <List.Item 
                            className={`${styles.layerItem} ${selectedElementId === el.id ? styles.layerItemActive : ''}`}
                            onClick={() => setSelectedElementId(el.id)}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                <DragOutlined style={{ color: '#ccc' }} />
                                <Text delete={!el.visible} style={{ flex: 1 }}>{el.name}</Text>
                                <Text type="secondary" style={{ fontSize: '10px' }}>{el.type}</Text>
                            </div>
                        </List.Item>
                    )}
                />
            </div>
        </div>
    )
}

export default ScenePanel
