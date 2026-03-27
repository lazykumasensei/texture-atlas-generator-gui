import { Tag, Typography, Tabs } from "antd"
import { PageContainer } from "@ant-design/pro-components"
const { Text } = Typography

import Canvas from "./Canvas"
import SidePanel from "./SidePanel"
import ImportPanel from "./ImportPanel"
import ClearBtn from "./ClearBtn"
import AnimationPanel from "./AnimationPanel"
import styles from "./style.css"

const  App = () => {
    const items = [
        {
            key: 'atlas',
            label: 'Atlas Texture',
            children: (
                <>
                    <ImportPanel />
                    <div className={styles.upperSection}>
                        <SidePanel />
                        <Canvas />
                    </div>
                </>
            ),
        },
        {
            key: 'animation',
            label: 'Sprite Animation',
            children: <AnimationPanel />,
        },
    ]

    return (
        <div id="app">
            <PageContainer
                header={{
                    extra: <ClearBtn />,
                }}
                ghost={false}
                className={styles.appbar}
            />
            <div style={{ padding: '0 24px' }}>
                <Tabs defaultActiveKey="atlas" items={items} />
            </div>
        </div>
    )
}

export default App