import React, { useState, useCallback, useRef, useEffect } from "react"
import { Button, Upload, Space, Input, List, Card, Typography, message, Tag } from "antd"
import { UploadOutlined, DownloadOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons"
import styles from "./style.css"

const { Text, Title } = Typography

const AnimationPanel = () => {
    const [atlasImage, setAtlasImage] = useState(null)
    const [sprites, setSprites] = useState([])
    const [animations, setAnimations] = useState([])
    const [currentAnimName, setCurrentAnimName] = useState("")
    const [imgElement, setImgElement] = useState(null)
    const [selectedSprite, setSelectedSprite] = useState(null)
    const [playingAnimIdx, setPlayingAnimIdx] = useState(-1)
    const [currentFrameIdx, setCurrentFrameIdx] = useState(0)
    
    const previewCanvasRef = useRef(null)
    const playbackCanvasRef = useRef(null)
    const playbackTimerRef = useRef(null)

    // Sprite Preview Logic
    useEffect(() => {
        if (selectedSprite && imgElement && previewCanvasRef.current) {
            const canvas = previewCanvasRef.current
            const ctx = canvas.getContext("2d")
            const { x, y, w, h } = selectedSprite
            
            // Constrain to 256x256 while maintaining aspect ratio
            const MAX_SIZE = 256
            const scale = Math.min(MAX_SIZE / w, MAX_SIZE / h, 1)
            const targetWidth = w * scale
            const targetHeight = h * scale

            canvas.width = targetWidth
            canvas.height = targetHeight
            ctx.clearRect(0, 0, targetWidth, targetHeight)
            ctx.drawImage(imgElement, x, y, w, h, 0, 0, targetWidth, targetHeight)
        }
    }, [selectedSprite, imgElement])

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
            const sprite = sprites.find(s => s.name === frameName)
            if (sprite) {
                const canvas = playbackCanvasRef.current
                const ctx = canvas.getContext("2d")
                const { x, y, w, h } = sprite

                // Constrain to 256x256
                const MAX_SIZE = 256
                const scale = Math.min(MAX_SIZE / w, MAX_SIZE / h, 1)
                const targetWidth = w * scale
                const targetHeight = h * scale

                canvas.width = targetWidth
                canvas.height = targetHeight
                ctx.clearRect(0, 0, targetWidth, targetHeight)
                ctx.drawImage(imgElement, x, y, w, h, 0, 0, targetWidth, targetHeight)
            }
        }
    }, [currentFrameIdx, playingAnimIdx, animations, sprites, imgElement])

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
        xmlContent += '</animations>'

        const blob = new Blob([xmlContent], { type: "application/xml" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "animations.xml"
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className={styles.animationPanel}>
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
                        </div>
                    </div>
                    
                    <div className={styles.scrollableList}>
                        <List
                            dataSource={sprites}
                            renderItem={item => (
                                <div 
                                    className={`${styles.spriteItem} ${selectedSprite?.name === item.name ? styles.spriteItemActive : ''}`}
                                    onClick={() => setSelectedSprite(item)}
                                >
                                    <Text>{item.name}</Text>
                                    <Space onClick={e => e.stopPropagation()}>
                                        <Text type="secondary">{item.w}x{item.h}</Text>
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

export default AnimationPanel
