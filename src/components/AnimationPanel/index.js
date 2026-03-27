import React, { useState, useRef, useEffect } from "react"
import { Button, Upload, Space, Input, List, Card, Typography, message, Tag, Modal, InputNumber, Select, Divider } from "antd"
import { UploadOutlined, DownloadOutlined, PlusOutlined, DeleteOutlined, SettingOutlined } from "@ant-design/icons"
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

    const previewCanvasRef = useRef(null)
    const playbackCanvasRef = useRef(null)
    const playbackTimerRef = useRef(null)

    const getSprite = (name) => {
        return sprites.find(s => s.name === name) || compositeSprites.find(s => s.name === name)
    }

    const drawSpriteRecursive = (ctx, sprite, offsetX, offsetY, scale, img) => {
        if (!sprite || !img) return
        if (sprite.isComposite) {
            const base = getSprite(sprite.baseSpriteName)
            drawSpriteRecursive(ctx, base, offsetX, offsetY, scale, img)
            sprite.layers.forEach(layer => {
                const ls = getSprite(layer.spriteName)
                drawSpriteRecursive(ctx, ls, offsetX + layer.x * scale, offsetY + layer.y * scale, scale, img)
            })
        } else {
            ctx.drawImage(img, sprite.x, sprite.y, sprite.w, sprite.h, offsetX, offsetY, sprite.w * scale, sprite.h * scale)
        }
    }

    const getSpriteBounds = (sprite) => {
        if (!sprite) return { w: 0, h: 0 }
        if (!sprite.isComposite) return { w: sprite.w, h: sprite.h }
        const base = getSprite(sprite.baseSpriteName)
        let { w, h } = getSpriteBounds(base)
        sprite.layers.forEach(layer => {
            const ls = getSprite(layer.spriteName)
            const lb = getSpriteBounds(ls)
            w = Math.max(w, layer.x + lb.w)
            h = Math.max(h, layer.y + lb.h)
        })
        return { w, h }
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
        if (playingAnimIdx !== -1 && animations[playingAnimIdx] && imgElement && playbackCanvasRef.current) {
            const anim = animations[playingAnimIdx]
            const frames = anim.frames
            if (frames.length === 0) return

            const updateFrame = () => {
                setCurrentFrameIdx(prev => (prev + 1) % frames.length)
            }

            const delay = anim.frameDuration || 200
            playbackTimerRef.current = setInterval(updateFrame, delay)
            return () => clearInterval(playbackTimerRef.current)
        }
    }, [playingAnimIdx, animations, imgElement])

    useEffect(() => {
        if (playingAnimIdx !== -1 && animations[playingAnimIdx] && imgElement && playbackCanvasRef.current) {
            const frameName = animations[playingAnimIdx].frames[currentFrameIdx]
            const sprite = getSprite(frameName)
            if (sprite) {
                const canvas = playbackCanvasRef.current
                const ctx = canvas.getContext("2d")
                const { w, h } = getSpriteBounds(sprite)

                const MAX_SIZE = 256
                const scale = Math.min(MAX_SIZE / w, MAX_SIZE / h, 1)
                const targetWidth = w * scale
                const targetHeight = h * scale

                canvas.width = targetWidth
                canvas.height = targetHeight
                ctx.clearRect(0, 0, targetWidth, targetHeight)
                drawSpriteRecursive(ctx, sprite, 0, 0, scale, imgElement)
            }
        }
    }, [currentFrameIdx, playingAnimIdx, animations, sprites, compositeSprites, imgElement])

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
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const parser = new DOMParser()
                const xmlDoc = parser.parseFromString(e.target.result, "text/xml")
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
                if (parsedSprites.length === 0) {
                    message.error("No sprites found in XML. Make sure it's the correct format.")
                } else {
                    setSprites(parsedSprites)
                    message.success(`${parsedSprites.length} sprites loaded.`)
                }
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
        const numFrames = anim.frames.length || 1
        
        if (field === "totalDuration") {
            anim.totalDuration = value
            anim.frameDuration = Math.round(value / numFrames)
        } else {
            anim.frameDuration = value
            anim.totalDuration = value * numFrames
        }
        setAnimations(newAnims)
    }

    const addFrameToAnim = (animIndex, spriteName) => {
        const newAnims = [...animations]
        const anim = newAnims[animIndex]
        anim.frames.push(spriteName)
        anim.totalDuration = anim.frameDuration * anim.frames.length
        setAnimations(newAnims)
    }

    const removeFrameFromAnim = (animIndex, frameIndex) => {
        const newAnims = [...animations]
        const anim = newAnims[animIndex]
        anim.frames.splice(frameIndex, 1)
        anim.totalDuration = anim.frameDuration * (anim.frames.length || 1)
        setAnimations(newAnims)
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
            layers: compLayers
        }
        setCompositeSprites([...compositeSprites, newComp])
        setIsCompositeModalVisible(false)
        setCompName("")
        setCompBase(null)
        setCompLayers([])
        message.success(`Composite sprite '${compName}' created.`)
    }

    const addLayer = () => {
        setCompLayers([...compLayers, { spriteName: sprites[0]?.name, x: 0, y: 0 }])
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
        if (animations.length === 0) {
            message.warning("No animations to export.")
            return
        }
        
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<animations>\n'
        animations.forEach(anim => {
            xmlContent += `  <animation name="${anim.name}" totalDuration="${anim.totalDuration}" frameDuration="${anim.frameDuration}">\n`
            anim.frames.forEach(frameName => {
                xmlContent += `    <frame n="${frameName}" />\n`
            })
            xmlContent += `  </animation>\n`
        })
        // Also export composite sprite definitions
        if (compositeSprites.length > 0) {
            xmlContent += '  <compositeSprites>\n'
            compositeSprites.forEach(cs => {
                xmlContent += `    <composite name="${cs.name}" base="${cs.baseSpriteName}">\n`
                cs.layers.forEach(l => {
                    xmlContent += `      <layer n="${l.spriteName}" x="${l.x}" y="${l.y}" />\n`
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
                width={800}
            >
                <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ flex: 1 }}>
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
                            <Divider>Layers (Overlays)</Divider>
                            {compLayers.map((layer, idx) => (
                                <Card size="small" key={idx} style={{ marginBottom: 10 }}>
                                    <Space align="center">
                                        <Select 
                                            style={{ width: 200 }} 
                                            value={layer.spriteName} 
                                            onChange={val => updateLayer(idx, "spriteName", val)}
                                        >
                                            {sprites.map(s => <Option key={s.name} value={s.name}>{s.name}</Option>)}
                                        </Select>
                                        <Text>X:</Text>
                                        <InputNumber size="small" value={layer.x} onChange={val => updateLayer(idx, "x", val)} />
                                        <Text>Y:</Text>
                                        <InputNumber size="small" value={layer.y} onChange={val => updateLayer(idx, "y", val)} />
                                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeLayer(idx)} />
                                    </Space>
                                </Card>
                            ))}
                            <Button type="dashed" onClick={addLayer} block icon={<PlusOutlined />}>Add Layer</Button>
                        </Space>
                    </div>
                    <div style={{ width: 300, background: '#fafafa', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                        <Title level={5}>Live Preview</Title>
                        <div style={{ height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #eee', background: '#fff' }}>
                            {/* Special preview for the modal */}
                            <CompositePreview 
                                baseName={compBase} 
                                layers={compLayers} 
                                getSprite={getSprite}
                                img={imgElement}
                                getSpriteBounds={getSpriteBounds}
                                drawSpriteRecursive={drawSpriteRecursive}
                            />
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
                            <Button size="small" icon={<SettingOutlined />} onClick={() => setIsCompositeModalVisible(true)}>
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
                                                <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => deleteComposite(item.name)} />
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
                                {playingAnimIdx !== -1 ? (
                                    <div style={{ textAlign: 'center' }}>
                                        <canvas ref={playbackCanvasRef} className={styles.previewCanvas} />
                                        <div style={{ marginTop: 5 }}>
                                            <Text strong>{animations[playingAnimIdx].name}</Text>
                                            <Text type="secondary"> (Frame {currentFrameIdx + 1}/{animations[playingAnimIdx].frames.length})</Text>
                                        </div>
                                    </div>
                                ) : (
                                    <Text type="secondary">Play an animation to see it here</Text>
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
                                <div className={styles.framesContainer}>
                                    {anim.frames.map((frameName, frameIdx) => (
                                        <Tag 
                                            key={frameIdx} 
                                            closable 
                                            onClose={() => removeFrameFromAnim(animIdx, frameIdx)}
                                            style={{ marginBottom: 4 }}
                                        >
                                            {frameName}
                                        </Tag>
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

const CompositePreview = ({ baseName, layers, getSprite, img, getSpriteBounds, drawSpriteRecursive }) => {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !img) return
        const ctx = canvas.getContext("2d")
        
        // Logical composite for preview
        const tempSprite = {
            isComposite: true,
            baseSpriteName: baseName,
            layers: layers
        }
        
        const { w, h } = getSpriteBounds(tempSprite)
        if (w === 0 || h === 0) return

        const MAX_SIZE = 256
        const scale = Math.min(MAX_SIZE / w, MAX_SIZE / h, 1)
        
        canvas.width = w * scale
        canvas.height = h * scale
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        drawSpriteRecursive(ctx, tempSprite, 0, 0, scale, img)
    }, [baseName, layers, img, getSprite, getSpriteBounds, drawSpriteRecursive])

    return <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%' }} />
}

export default AnimationPanel
