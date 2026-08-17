export async function* parseSse(stream) {
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let event = '';
    let dataLines = [];
    const flush = () => {
        if (dataLines.length === 0)
            return null;
        const out = { data: dataLines.join('\n') };
        if (event.length > 0)
            out.event = event;
        event = '';
        dataLines = [];
        return out;
    };
    for await (const raw of stream) {
        buffer += decoder.decode(Buffer.isBuffer(raw) ? raw : Buffer.from(raw), { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx).replace(/\r$/, '');
            buffer = buffer.slice(idx + 1);
            if (line === '') {
                const ev = flush();
                if (ev)
                    yield ev;
                continue;
            }
            if (line.startsWith(':'))
                continue;
            const sep = line.indexOf(':');
            const field = sep >= 0 ? line.slice(0, sep) : line;
            const value = sep >= 0 ? line.slice(sep + 1).replace(/^ /, '') : '';
            if (field === 'event')
                event = value;
            else if (field === 'data')
                dataLines.push(value);
        }
    }
    const ev = flush();
    if (ev)
        yield ev;
}
