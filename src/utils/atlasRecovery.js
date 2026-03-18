/**
 * Detects rectangles (bounding boxes) of non-transparent pixel groups in an ImageData object.
 * Uses a BFS-based connected component discovery algorithm.
 * 
 * @param {ImageData} imageData 
 * @returns {Array<{x: number, y: number, width: number, height: number}>}
 */
export const detectRectsFromAlpha = (imageData) => {
    const { width, height, data } = imageData
    const visited = new Uint8Array(width * height)
    const rects = []

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x
            const alpha = data[idx * 4 + 3]

            if (alpha > 0 && !visited[idx]) {
                // Found a new connected component
                let minX = x, maxX = x, minY = y, maxY = y
                const queue = [[x, y]]
                visited[idx] = 1

                let head = 0
                while (head < queue.length) {
                    const [cx, cy] = queue[head++]
                    
                    if (cx < minX) minX = cx
                    if (cx > maxX) maxX = cx
                    if (cy < minY) minY = cy
                    if (cy > maxY) maxY = cy

                    // Check neighbors (4-connectivity)
                    const neighbors = [
                        [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
                    ]

                    for (const [nx, ny] of neighbors) {
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nIdx = ny * width + nx
                            if (!visited[nIdx] && data[nIdx * 4 + 3] > 0) {
                                visited[nIdx] = 1
                                queue.push([nx, ny])
                            }
                        }
                    }
                }
                
                rects.push({
                    x: minX,
                    y: minY,
                    width: maxX - minX + 1,
                    height: maxY - minY + 1
                })
            }
        }
    }

    return rects
}

/**
 * Extracts a sprite from an atlas image given a rect.
 * 
 * @param {HTMLImageElement} image 
 * @param {{x: number, y: number, width: number, height: number}} rect 
 * @returns {Promise<{src: string, width: number, height: number}>}
 */
export const extractSpriteFromAtlas = (image, rect) => {
    return new Promise((resolve) => {
        const canvas = document.createElement("canvas")
        canvas.width = rect.width
        canvas.height = rect.height
        const ctx = canvas.getContext("2d")
        ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height)
        resolve({
            src: canvas.toDataURL(),
            width: rect.width,
            height: rect.height
        })
    })
}
