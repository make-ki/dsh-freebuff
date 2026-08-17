/**
 * Client half of dsh-freebuff: a "Freebuff" section on the Settings page
 * (settings.section slot) with visual credential / proxy / health editing.
 * Talks to the host JSON API under /freebuff/api.
 */
export const inject = ['slots'];
const styles = [
    '.fb-page{font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;padding:14px 16px;max-width:720px;display:flex;flex-direction:column;gap:12px}',
    '.fb-title{font-size:13px;font-weight:600;margin:0;color:var(--theme-text,#ddd)}',
    '.fb-sub{color:var(--theme-text-secondary,#888);margin:0;font-size:11px}',
    '.fb-card{border:1px solid var(--theme-border,#333);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:var(--theme-bg-module,rgba(255,255,255,.02))}',
    '.fb-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.fb-label{font-size:11px;color:var(--theme-text-secondary,#888);min-width:72px}',
    '.fb-input{flex:1;min-width:200px;background:var(--theme-input-bg,#111);color:var(--theme-text,#ddd);border:1px solid var(--theme-border,#333);border-radius:6px;padding:6px 8px;font-size:12px;font-family:inherit}',
    '.fb-input:focus{border-color:var(--theme-accent,#4a9eff);outline:none}',
    'textarea.fb-input{min-height:64px;resize:vertical}',
    '.fb-btn{background:var(--theme-accent,#4a9eff);color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px}',
    '.fb-btn.ghost{background:transparent;border:1px solid var(--theme-border,#444);color:var(--theme-text,#ccc)}',
    '.fb-btn.danger{background:transparent;border:1px solid #d33;color:#d33}',
    '.fb-btn:disabled{opacity:.45;cursor:default}',
    '.fb-msg{margin:0;padding:8px 10px;border-radius:6px;background:var(--theme-input-bg,#111);border:1px solid var(--theme-border,#333);white-space:pre-wrap;font-size:11px;display:none}',
    '.fb-msg.show{display:block}',
    '.fb-msg.err{border-color:#d33;color:#f88}',
    '.fb-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}',
    '.fb-dot.ok{background:#2ecc71}.fb-dot.bad{background:#e74c3c}.fb-dot.na{background:#888}',
    '.fb-models{display:flex;flex-direction:column;gap:4px}',
    '.fb-model{display:flex;gap:8px;align-items:baseline;font-size:11px}',
    '.fb-model .id{color:var(--theme-text,#ddd);font-weight:600}',
    '.fb-model .nm{color:var(--theme-text-secondary,#888)}',
    '.fb-hint{color:var(--theme-text-secondary,#888);font-size:11px;margin:0}',
].join('\n');
function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls)
        node.className = cls;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
async function fetchJson(path, init) {
    const response = await fetch('/freebuff/api' + path, {
        headers: { 'content-type': 'application/json' },
        ...init,
    });
    return response.json();
}
export function apply(ctx) {
    ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'freebuff-config',
        order: 55,
        label: () => 'Freebuff',
        component: () => ({
            render() {
                const style = document.createElement('style');
                style.textContent = styles;
                const page = el('div', 'fb-page');
                page.append(el('h3', 'fb-title', 'Freebuff（免费 DeepSeek V4 Flash 提供商）'), el('p', 'fb-sub', '凭证与模型页共享：这里写入的内容与「设置 > 模型」中 Freebuff 卡片的「配置凭证」一致。'));
                const credCard = el('div', 'fb-card');
                const credHead = el('div', 'fb-row');
                const dot = el('span', 'fb-dot na');
                const credLabel = el('span', 'fb-label', '凭证');
                credHead.append(dot, credLabel);
                const keyInput = el('textarea', 'fb-input');
                keyInput.placeholder = '粘贴 authToken（多账号每行一个，或用逗号分隔）';
                const credActions = el('div', 'fb-row');
                const saveBtn = el('button', 'fb-btn', '保存凭证');
                const clearBtn = el('button', 'fb-btn danger', '清除');
                const refreshBtn = el('button', 'fb-btn ghost', '刷新');
                credActions.append(saveBtn, clearBtn, refreshBtn);
                credCard.append(credHead, keyInput, credActions);
                const proxyCard = el('div', 'fb-card');
                proxyCard.append(el('div', 'fb-label', '上游代理'));
                const proxyRow = el('div', 'fb-row');
                const proxyInput = el('input', 'fb-input');
                proxyInput.placeholder = 'http://host:port（留空自动选择：DSH 代理 → Windows 系统代理 → 环境变量）';
                const proxySave = el('button', 'fb-btn ghost', '保存');
                proxyRow.append(proxyInput, proxySave);
                const proxyState = el('p', 'fb-hint', '当前解析：…');
                proxyCard.append(proxyRow, proxyState);
                const healthCard = el('div', 'fb-card');
                const healthRow = el('div', 'fb-row');
                const probeBtn = el('button', 'fb-btn ghost', '健康检查（GET /me，不消耗额度）');
                healthRow.append(probeBtn);
                const healthState = el('p', 'fb-hint', '');
                healthCard.append(healthRow, healthState);
                const modelsCard = el('div', 'fb-card');
                modelsCard.append(el('div', 'fb-label', '可用模型'));
                const modelsList = el('div', 'fb-models');
                modelsCard.append(modelsList);
                const msg = el('div', 'fb-msg');
                page.append(credCard, proxyCard, healthCard, modelsCard, msg);
                const say = (text, isErr = false) => {
                    msg.textContent = text;
                    msg.className = 'fb-msg show' + (isErr ? ' err' : '');
                };
                const renderStatus = (data) => {
                    const accountList = data.accounts ?? [];
                    const autoResolved = accountList.length > 0;
                    dot.className = 'fb-dot ' + (data.credentialConfigured ? 'ok' : autoResolved ? 'na' : 'bad');
                    credLabel.textContent = '凭证（' + (data.apiKeyEnv ?? 'FREEBUFF_API_KEY') + '）';
                    const desc = data.credentialConfigured
                        ? '已配置'
                        : autoResolved
                            ? '自动解析中（' + accountList.map((a) => a.email ?? a.token).join(', ') + '）'
                            : '未配置';
                    dot.title = desc;
                    keyInput.placeholder = '粘贴 authToken（当前：' + desc + '）';
                    proxyInput.value = '';
                    proxyState.textContent =
                        '当前解析：source=' + (data.proxy?.source ?? 'none') + ' url=' + (data.proxy?.url ?? '（直连/未解析）');
                    modelsList.textContent = '';
                    for (const m of data.models ?? []) {
                        const row = el('div', 'fb-model');
                        row.append(el('span', 'id', m.id), el('span', 'nm', m.name));
                        modelsList.append(row);
                    }
                };
                const refresh = async () => {
                    try {
                        const data = (await fetchJson('/status'));
                        if (data.ok)
                            renderStatus(data);
                        else
                            say(JSON.stringify(data), true);
                    }
                    catch (error) {
                        say('状态加载失败：' + String(error), true);
                    }
                };
                saveBtn.addEventListener('click', async () => {
                    const value = keyInput.value.trim();
                    if (!value)
                        return say('请先粘贴 token', true);
                    saveBtn.disabled = true;
                    saveBtn.textContent = '保存中…';
                    try {
                        const result = await fetchJson('/credentials', { method: 'POST', body: JSON.stringify({ value }) });
                        say(result.ok ? '✅ 凭证已保存（模型页绿点 = 已配置）' : JSON.stringify(result), !result.ok);
                        if (result.ok)
                            keyInput.value = '';
                        await refresh();
                    }
                    catch (error) {
                        say('保存失败：' + String(error), true);
                    }
                    finally {
                        saveBtn.disabled = false;
                        saveBtn.textContent = '保存凭证';
                    }
                });
                clearBtn.addEventListener('click', async () => {
                    clearBtn.disabled = true;
                    try {
                        const result = await fetchJson('/credentials/clear', { method: 'POST' });
                        say(result.ok ? '凭证已清除' : JSON.stringify(result), !result.ok);
                        await refresh();
                    }
                    catch (error) {
                        say('清除失败：' + String(error), true);
                    }
                    finally {
                        clearBtn.disabled = false;
                    }
                });
                refreshBtn.addEventListener('click', () => void refresh());
                proxySave.addEventListener('click', async () => {
                    proxySave.disabled = true;
                    try {
                        say('代理解析由插件自动完成；如需固定地址，请在插件配置（llm-freebuff 段）填写 upstreamProxy 后重启。');
                        await refresh();
                    }
                    finally {
                        proxySave.disabled = false;
                    }
                });
                probeBtn.addEventListener('click', async () => {
                    probeBtn.disabled = true;
                    healthState.textContent = '探测中…';
                    try {
                        const result = (await fetchJson('/probe', { method: 'POST' }));
                        healthState.textContent = result.ok
                            ? '✅ 账号可用（HTTP ' + result.status + (result.uid ? '，uid=' + result.uid : '') + '）'
                            : '⚠️ HTTP ' + (result.status ?? '-') + '：' + (result.message ?? result.accountStatus ?? '未知');
                    }
                    catch (error) {
                        healthState.textContent = '探测失败：' + String(error);
                    }
                    finally {
                        probeBtn.disabled = false;
                    }
                });
                void refresh();
                const timer = window.setInterval(() => void refresh(), 60_000);
                return {
                    dispose: () => window.clearInterval(timer),
                };
            },
        }),
    })), 'dsh-freebuff: settings section');
}
