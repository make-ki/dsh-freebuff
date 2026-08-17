window.__ModuleLoader__.load({
  id: "dsh-freebuff",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    //#region src/client.ts
    const inject = ["slots"];
    const React = require("react");
    const { useState, useEffect, useCallback } = React;
    const h = React.createElement;
    const styles = [
    	".fb-page{display:flex;flex-direction:column;gap:12px;max-width:720px}",
    	".fb-title{margin:0;font-size:15px;line-height:22px;font-weight:600;color:var(--dsw-alias-label-primary)}",
    	".fb-sub{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
    	".fb-card{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2)}",
    	".fb-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
    	".fb-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);min-width:72px;flex:none}",
    	".fb-input{flex:1;min-width:220px;background:var(--dsw-alias-input-bg,var(--dsw-alias-bg-module-platform));color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:7px 9px;font-size:13px;font-family:inherit}",
    	".fb-input:focus{border-color:var(--dsw-alias-accent-strong,rgb(74,158,255));outline:none}",
    	"textarea.fb-input{min-height:72px;resize:vertical}",
    	".fb-btn{border:none;border-radius:10px;padding:7px 14px;cursor:pointer;font-size:13px;color:var(--dsw-alias-button-primary-fg,#fff);background:var(--dsw-alias-accent,var(--dsw-alias-button-primary-fill,rgb(74,158,255)));font-family:inherit}",
    	".fb-btn.ghost{background:transparent;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}",
    	".fb-btn.danger{background:transparent;border:1px solid rgb(214,69,69);color:rgb(214,69,69)}",
    	".fb-btn:disabled{opacity:.45;cursor:default}",
    	".fb-msg{margin:0;padding:9px 11px;border-radius:8px;background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);white-space:pre-wrap;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary)}",
    	".fb-msg.err{border-color:rgb(214,69,69);color:rgb(240,120,120)}",
    	".fb-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}",
    	".fb-dot.ok{background:rgb(46,204,113)}.fb-dot.bad{background:rgb(231,76,60)}.fb-dot.na{background:rgb(150,150,150)}",
    	".fb-models{display:flex;flex-direction:column;gap:4px}",
    	".fb-model{display:flex;gap:8px;align-items:baseline;font-size:12px}",
    	".fb-model .id{color:var(--dsw-alias-label-primary);font-weight:600;font-family:ui-monospace,monospace}",
    	".fb-model .nm{color:var(--dsw-alias-label-secondary)}",
    	".fb-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}"
    ].join("\n");
    async function fetchJson(path, init) {
    	try {
    		return await (await fetch("/freebuff/api" + path, {
    			headers: { "content-type": "application/json" },
    			...init
    		})).json();
    	} catch (error) {
    		return {
    			ok: false,
    			error: String(error)
    		};
    	}
    }
    function SettingsView() {
    	const [status, setStatus] = useState(null);
    	const [token, setToken] = useState("");
    	const [msg, setMsg] = useState(null);
    	const [health, setHealth] = useState("");
    	const [busy, setBusy] = useState(false);
    	const refresh = useCallback(async () => {
    		const data = await fetchJson("/status");
    		if (data.ok) setStatus(data);
    		else setMsg({
    			text: JSON.stringify(data),
    			isErr: true
    		});
    	}, []);
    	useEffect(() => {
    		refresh();
    		const timer = window.setInterval(() => void refresh(), 6e4);
    		return () => window.clearInterval(timer);
    	}, [refresh]);
    	const say = (text, isErr = false) => setMsg({
    		text,
    		isErr
    	});
    	const save = async () => {
    		const value = token.trim();
    		if (!value) return say("请先粘贴 token", true);
    		setBusy(true);
    		try {
    			const result = await fetchJson("/credentials", {
    				method: "POST",
    				body: JSON.stringify({ value })
    			});
    			say(result.ok ? "✅ 凭证已保存（模型页绿点 = 已配置）" : JSON.stringify(result), !result.ok);
    			if (result.ok) setToken("");
    			await refresh();
    		} finally {
    			setBusy(false);
    		}
    	};
    	const clear = async () => {
    		setBusy(true);
    		try {
    			const result = await fetchJson("/credentials/clear", { method: "POST" });
    			say(result.ok ? "凭证已清除" : JSON.stringify(result), !result.ok);
    			await refresh();
    		} finally {
    			setBusy(false);
    		}
    	};
    	const probe = async () => {
    		setHealth("探测中…");
    		try {
    			const result = await fetchJson("/probe", { method: "POST" });
    			setHealth(result.ok ? "✅ 账号可用（HTTP " + result.status + (result.uid ? "，uid=" + result.uid : "") + "）" : "⚠️ HTTP " + (result.status ?? "-") + "：" + (result.message ?? result.accountStatus ?? "未知"));
    		} catch (error) {
    			setHealth("探测失败：" + String(error));
    		}
    	};
    	const accountList = status?.accounts ?? [];
    	const autoResolved = accountList.length > 0 && status?.credentialConfigured !== true;
    	const dotClass = status?.credentialConfigured ? "fb-dot ok" : autoResolved ? "fb-dot na" : "fb-dot bad";
    	const credDesc = status?.credentialConfigured ? "已配置" : autoResolved ? "自动解析中（" + accountList.map((a) => a.email ?? a.token).join(", ") + "）" : "未配置";
    	const proxyState = "当前解析：source=" + (status?.proxy?.source ?? "none") + " url=" + (status?.proxy?.url ?? "（直连/未解析）");
    	return h("div", { className: "fb-page" }, [
    		h("h3", {
    			className: "fb-title",
    			key: "t"
    		}, "Freebuff（免费 DeepSeek V4 Flash 提供商）"),
    		h("p", {
    			className: "fb-sub",
    			key: "s"
    		}, "凭证与模型页共享：这里写入的内容与「设置 > 模型」中 Freebuff 卡片的「配置凭证」一致。"),
    		h("div", {
    			className: "fb-card",
    			key: "cred"
    		}, [
    			h("div", { className: "fb-row" }, [h("span", {
    				className: dotClass,
    				key: "dot"
    			}), h("span", {
    				className: "fb-label",
    				key: "lbl"
    			}, "凭证（" + (status?.apiKeyEnv ?? "FREEBUFF_API_KEY") + "） · " + credDesc)]),
    			h("textarea", {
    				className: "fb-input",
    				key: "in",
    				placeholder: "粘贴 authToken（多账号每行一个，或用逗号分隔）",
    				value: token,
    				onChange: (e) => setToken(e.target.value)
    			}),
    			h("div", {
    				className: "fb-row",
    				key: "act"
    			}, [
    				h("button", {
    					className: "fb-btn",
    					key: "save",
    					disabled: busy,
    					onClick: () => void save()
    				}, "保存凭证"),
    				h("button", {
    					className: "fb-btn danger",
    					key: "clr",
    					disabled: busy,
    					onClick: () => void clear()
    				}, "清除"),
    				h("button", {
    					className: "fb-btn ghost",
    					key: "ref",
    					disabled: busy,
    					onClick: () => void refresh()
    				}, "刷新")
    			])
    		]),
    		h("div", {
    			className: "fb-card",
    			key: "proxy"
    		}, [
    			h("div", {
    				className: "fb-label",
    				key: "pl"
    			}, "上游代理"),
    			h("p", {
    				className: "fb-hint",
    				key: "ps"
    			}, proxyState),
    			h("p", {
    				className: "fb-hint",
    				key: "ph"
    			}, "固定地址请在插件配置（llm-freebuff 段）填写 upstreamProxy 后重启；此处仅展示实际生效的代理。")
    		]),
    		h("div", {
    			className: "fb-card",
    			key: "health"
    		}, [h("div", {
    			className: "fb-row",
    			key: "hr"
    		}, [h("button", {
    			className: "fb-btn ghost",
    			key: "pb",
    			disabled: busy,
    			onClick: () => void probe()
    		}, "健康检查（GET /me，不消耗额度）")]), h("p", {
    			className: "fb-hint",
    			key: "hs"
    		}, health || " ")]),
    		h("div", {
    			className: "fb-card",
    			key: "models"
    		}, [h("div", {
    			className: "fb-label",
    			key: "ml"
    		}, "可用模型"), h("div", {
    			className: "fb-models",
    			key: "mm"
    		}, (status?.models ?? []).map((m) => h("div", {
    			className: "fb-model",
    			key: m.id
    		}, [h("span", {
    			className: "id",
    			key: "i"
    		}, m.id), h("span", {
    			className: "nm",
    			key: "n"
    		}, m.name)])))]),
    		msg ? h("div", {
    			className: "fb-msg" + (msg.isErr ? " err" : ""),
    			key: "msg"
    		}, msg.text) : null
    	]);
    }
    function apply(ctx) {
    	ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
    		name: "settings.section",
    		id: "freebuff-config",
    		order: 55,
    		label: "Freebuff"
    	}, () => {
    		const style = document.createElement("style");
    		style.textContent = styles;
    		document.head.appendChild(style);
    		return h("div", { className: "" }, h(SettingsView));
    	})), "dsh-freebuff: settings section");
    }
    //#endregion
    exports.apply = apply;
    exports.inject = inject;
    
    return module.exports;
  }
});
