import { useEffect, useRef, useState, useCallback } from "react"
import { Modal, Button, Space, Typography } from "antd"
import { detectRectsFromAlpha, extractSpriteFromAtlas } from "../../utils/atlasRecovery"
import styles from "./style.css"

const { Text } = Typography

const RecoveryModal = ({ visible, onCancel, onImport, imageFile }) => {
    const canvasRef = useRef(null)
    const [image, setImage] = useState(null)
    const [rects, setRects] = useState([])
    const [selectedRectIndex, setSelectedRectIndex] = useState(-1)
    const [isDragging, setIsDragging] = useState(false)
    const [dragMode, setDragMode] = useState(null) // 'move' | 'resize' | 'create'
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [resizeHandle, setResizeHandle] = useState(null) // 'tl', 'tr', 'bl', 'br'

    // Load image and detect rects
    useEffect(() => {
        if (!imageFile || !visible) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                setImage(img)
                const canvas = document.createElement("canvas")
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext("2d")
                ctx.drawImage(img, 0, 0)
                const imageData = ctx.getImageData(0, 0, img.width, img.height)
                const detectedRects = detectRectsFromAlpha(imageData)
                setRects(detectedRects)
            }
            img.src = e.target.result
        }
        reader.readAsDataURL(imageFile)
    }, [imageFile, visible])

    const draw = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas || !image) return
        const ctx = canvas.getContext("2d")

        // Draw image
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0)

        // Draw rects
        rects.forEach((rect, index) => {
            const isSelected = index === selectedRectIndex
            ctx.strokeStyle = isSelected ? "#1890ff" : "rgba(24, 144, 255, 0.5)"
            ctx.lineWidth = isSelected ? 2 : 1
            ctx.setLineDash(isSelected ? [] : [5, 5])
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
            
            if (isSelected) {
                ctx.fillStyle = "rgba(24, 144, 255, 0.2)"
                ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
                
                // Draw handles
                const handleSize = 6
                ctx.fillStyle = "#1890ff"
                ctx.setLineDash([])
                ctx.fillRect(rect.x - handleSize/2, rect.y - handleSize/2, handleSize, handleSize)
                ctx.fillRect(rect.x + rect.width - handleSize/2, rect.y - handleSize/2, handleSize, handleSize)
                ctx.fillRect(rect.x - handleSize/2, rect.y + rect.height - handleSize/2, handleSize, handleSize)
                ctx.fillRect(rect.x + rect.width - handleSize/2, rect.y + rect.height - handleSize/2, handleSize, handleSize)
            }
        })
    }, [image, rects, selectedRectIndex])

    useEffect(() => {
        draw()
    }, [draw])

    const getMousePos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect()
        return {
            x: Math.round(e.clientX - rect.left),
            y: Math.round(e.clientY - rect.top)
        }
    }

    const hitTestHandle = (pos, rect) => {
        const handleSize = 10
        if (Math.abs(pos.x - rect.x) < handleSize && Math.abs(pos.y - rect.y) < handleSize) return 'tl'
        if (Math.abs(pos.x - (rect.x + rect.width)) < handleSize && Math.abs(pos.y - rect.y) < handleSize) return 'tr'
        if (Math.abs(pos.x - rect.x) < handleSize && Math.abs(pos.y - (rect.y + rect.height)) < handleSize) return 'bl'
        if (Math.abs(pos.x - (rect.x + rect.width)) < handleSize && Math.abs(pos.y - (rect.y + rect.height)) < handleSize) return 'br'
        return null
    }

    const hitTestRect = (pos) => {
        for (let i = rects.length - 1; i >= 0; i--) {
            const r = rects[i]
            if (pos.x >= r.x && pos.x <= r.x + r.width && pos.y >= r.y && pos.y <= r.y + r.height) {
                return i
            }
        }
        return -1
    }

    const onMouseDown = (e) => {
        const pos = getMousePos(e)
        const handle = selectedRectIndex !== -1 ? hitTestHandle(pos, rects[selectedRectIndex]) : null
        
        if (handle) {
            setDragMode('resize')
            setResizeHandle(handle)
            setIsDragging(true)
            setDragStart(pos)
        } else {
            const rectIndex = hitTestRect(pos)
            if (rectIndex !== -1) {
                setSelectedRectIndex(rectIndex)
                setDragMode('move')
                setIsDragging(true)
                setDragStart(pos)
            } else {
                setSelectedRectIndex(-1)
                setDragMode('create')
                setIsDragging(true)
                setDragStart(pos)
                setRects([...rects, { x: pos.x, y: pos.y, width: 0, height: 0 }])
                setSelectedRectIndex(rects.length)
            }
        }
    }

    const onMouseMove = (e) => {
        if (!isDragging) return
        const pos = getMousePos(e)
        const dx = pos.x - dragStart.x
        const dy = pos.y - dragStart.y

        setRects(prev => {
            const newRects = [...prev]
            const rect = { ...newRects[selectedRectIndex] }

            if (dragMode === 'move') {
                rect.x += dx
                rect.y += dy
            } else if (dragMode === 'resize') {
                if (resizeHandle.includes('t')) {
                    rect.y += dy
                    rect.height -= dy
                }
                if (resizeHandle.includes('b')) {
                    rect.height += dy
                }
                if (resizeHandle.includes('l')) {
                    rect.x += dx
                    rect.width -= dx
                }
                if (resizeHandle.includes('r')) {
                    rect.width += dx
                }
            } else if (dragMode === 'create') {
                rect.width = pos.x - dragStart.x
                rect.height = pos.y - dragStart.y
            }

            newRects[selectedRectIndex] = rect
            return newRects
        })
        setDragStart(pos)
    }

    const onMouseUp = () => {
        if (dragMode === 'create') {
            // Remove if tiny
            const rect = rects[selectedRectIndex]
            if (Math.abs(rect.width) < 5 || Math.abs(rect.height) < 5) {
                setRects(prev => prev.filter((_, i) => i !== selectedRectIndex))
                setSelectedRectIndex(-1)
            } else {
                // Normalize if negative
                setRects(prev => {
                    const newRects = [...prev]
                    const r = { ...newRects[selectedRectIndex] }
                    if (r.width < 0) { r.x += r.width; r.width = Math.abs(r.width) }
                    if (r.height < 0) { r.y += r.height; r.height = Math.abs(r.height) }
                    newRects[selectedRectIndex] = r
                    return newRects
                })
            }
        }
        setIsDragging(false)
        setDragMode(null)
    }

    const handleDelete = () => {
        if (selectedRectIndex !== -1) {
            setRects(prev => prev.filter((_, i) => i !== selectedRectIndex))
            setSelectedRectIndex(-1)
        }
    }

    const handleImport = async () => {
        const sprites = await Promise.all(rects.map(r => extractSpriteFromAtlas(image, r)))
        onImport(sprites.map((s, i) => ({
            ...s,
            name: `${imageFile.name.replace(/\..+/, "")}_${i}`
        })))
    }

    return (
        <Modal
            title="Atlas Data Recovery"
            visible={visible}
            onCancel={onCancel}
            width={850}
            footer={[
                <Button key="delete" danger onClick={handleDelete} disabled={selectedRectIndex === -1}>
                    Delete Selected
                </Button>,
                <Button key="cancel" onClick={onCancel}>
                    Cancel
                </Button>,
                <Button key="import" type="primary" onClick={handleImport}>
                    Import {rects.length} Sprites
                </Button>
            ]}
        >
            <div style={{ marginBottom: 16 }}>
                <Text type="secondary">
                    Detected {rects.length} sprites. You can drag to move, resize by handles, or drag on empty space to add new rects.
                </Text>
            </div>
            <div className={styles.recoveryCanvasContainer} style={{ maxHeight: '60vh', overflow: 'auto', border: '1px solid #d9d9d9', background: '#f5f5f5' }}>
                <canvas
                    ref={canvasRef}
                    width={image?.width || 0}
                    height={image?.height || 0}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    style={{ cursor: isDragging ? 'grabbing' : 'crosshair', display: 'block', margin: '0 auto' }}
                />
            </div>
        </Modal>
    )
}

export default RecoveryModal
