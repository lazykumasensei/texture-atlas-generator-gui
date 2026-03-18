import { useCallback, useContext, useState } from "react"
import { notification, Tooltip } from "antd"
import { PlusOutlined, FileImageOutlined } from "@ant-design/icons"

import AppContext from "../../AppContext"
import RecoveryModal from "./RecoveryModal"
import styles from "./style.css"

const readFile = file => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const tempImg = new Image()

            const { result } = reader
            tempImg.src = result

            tempImg.onload = () => {
                resolve({ name: file.name.replace(/\..+/, "").trim(), originalName: file.name, src: result, width: tempImg.width, height: tempImg.height })
            }
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

export default () => {
    const { importAxns, imports } = useContext(AppContext)
    const [recoveryVisible, setRecoveryVisible] = useState(false)
    const [recoveryFile, setRecoveryFile] = useState(null)

    const onNewFiles = useCallback(async e => {
        const newImports = []
        for (const file of e.target.files) {
            const newImport = await readFile(file)
            const duplicate = !!imports.some(({ name }) => {
                return name === newImport.name
            })
            if (duplicate) {
                notification.open({
                    message: "Duplicate Import",
                    description: `Attempting to import a duplicate image or an image with the filename that clashes with one of the already imported images: "${newImport.originalName}"`
                })
            } else {
                newImports.push(newImport)
            }
        }
        importAxns.add(newImports)
        e.target.value = null
    }, [ imports ])

    const onRecoveryFileSelect = (e) => {
        const file = e.target.files[0]
        if (file) {
            setRecoveryFile(file)
            setRecoveryVisible(true)
        }
        e.target.value = null
    }

    const onImportRecovered = (sprites) => {
        importAxns.add(sprites)
        setRecoveryVisible(false)
        setRecoveryFile(null)
    }

    return (
       <div style={{ display: "flex", gap: "8px" }}>
        <input id="import-field" type="file" style={{ display: "none" }} onChange={onNewFiles} accept="image/*" multiple></input>
        <label htmlFor="import-field">
            <Tooltip title="Import Sprites">
                <div className={styles.importBtn}>
                    <PlusOutlined/>
                </div>
            </Tooltip>
        </label>

        <input id="recovery-field" type="file" style={{ display: "none" }} onChange={onRecoveryFileSelect} accept="image/*"></input>
        <label htmlFor="recovery-field">
            <Tooltip title="Recover Atlas from Image (Alpha-based)">
                <div className={styles.recoveryBtn}>
                    <FileImageOutlined />
                </div>
            </Tooltip>
        </label>

        <RecoveryModal
            visible={recoveryVisible}
            imageFile={recoveryFile}
            onCancel={() => setRecoveryVisible(false)}
            onImport={onImportRecovered}
        />
       </div>
    )
}