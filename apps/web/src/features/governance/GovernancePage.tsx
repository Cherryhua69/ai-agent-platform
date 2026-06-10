import { KeyValueList, PageScaffold, Panel, SimpleTable, StatusPill } from "../shared/ViewBlocks";

export function GovernancePage() {
  return (
    <PageScaffold
      eyebrow="治理 / Workspace & Audit"
      title="治理设置"
      description="强化 workspace、多用户隔离、私有化部署、高风险操作规则和审计日志。"
    >
      <div className="grid-two">
        <Panel title="空间 / 项目 / 角色" strong>
          <SimpleTable
            columns={["成员", "角色", "范围", "能力", "状态"]}
            rows={[
              ["陈晓", "Developer", "客服自动化", "Agent + Flow", <StatusPill tone="ok">active</StatusPill>],
              ["王宁", "Operator", "知识库 / 评测", "KB + Release", <StatusPill tone="ok">active</StatusPill>],
              ["周文", "Admin", "全空间", "Secrets + Audit", <StatusPill tone="ok">active</StatusPill>]
            ]}
          />
        </Panel>
        <Panel title="私有化与高风险规则">
          <KeyValueList
            items={[
              ["部署模式", <StatusPill>Docker Compose / 私有网络</StatusPill>],
              ["数据库写入", <StatusPill tone="bad">默认阻断</StatusPill>],
              ["外部 API 写操作", <StatusPill tone="warn">确认后执行</StatusPill>],
              ["密钥轮换", <StatusPill tone="warn">2 个 30 天内过期</StatusPill>],
              ["审计日志", <StatusPill tone="ok">强制记录</StatusPill>]
            ]}
          />
        </Panel>
      </div>
    </PageScaffold>
  );
}
