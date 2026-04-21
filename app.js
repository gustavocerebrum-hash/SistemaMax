// ==========================================
// 1. RELÓGIO E UTILIDADES (MOVIDO PARA O TOPO)
// ==========================================
function getBrasiliaTime() {
    const now = new Date();
    const iso  = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(now);
    const br   = now.toLocaleDateString('pt-BR',  { timeZone: 'America/Sao_Paulo' });
    const hhmm = now.toLocaleTimeString('pt-BR',  { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
    return { iso, br, hhmm };
}

function updateClock() {
    try {
        const t = getBrasiliaTime();
        const timeEl = document.getElementById('bsb-time');
        const dateEl = document.getElementById('bsb-date');
        if (timeEl) timeEl.textContent = t.hhmm;
        if (dateEl && (dateEl.textContent === 'Buscando...' || dateEl.textContent === 'Sincronizando...')) dateEl.textContent = t.br;
        else if (dateEl && !dateEl.textContent.includes('/')) dateEl.textContent = t.br;
    } catch (e) {}
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================
// 2. BANCOS DE DADOS LOCAIS (DECLARAÇÕES)
// ==========================================
if (!localStorage.getItem('v_max_v7_start')) {
    localStorage.clear();
    localStorage.setItem('v_max_v7_start', 'true');
}

let dbOsCounters = JSON.parse(localStorage.getItem('dbOsCounters')) || {};
let dbPedidos      = JSON.parse(localStorage.getItem('dbPedidos'))      || [];
let dbCorte        = JSON.parse(localStorage.getItem('dbCorte'))        || [];
let dbCostura      = JSON.parse(localStorage.getItem('dbCostura'))      || [];
let dbCosturado    = JSON.parse(localStorage.getItem('dbCosturado'))    || [];
let dbAcabamento   = JSON.parse(localStorage.getItem('dbAcabamento'))   || [];
let dbReserva      = JSON.parse(localStorage.getItem('dbReserva'))      || [];
let dbReservaSaidas= JSON.parse(localStorage.getItem('dbReservaSaidas'))|| [];

// ==========================================
// 3. SUPABASE INITIALIZATION
// ==========================================
const supabaseUrl = 'https://cgueweucovryodflmoxd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndWV3ZXVjb3ZyeW9kZmxtb3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3Mzk2OTksImV4cCI6MjA5MjMxNTY5OX0.6rroezBoFeJTKlIrzhJb4MhedN4-sDMvGjcERhjfypI';

let supabase;
try {
    if (window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    }
} catch (e) { console.error("Supabase fail:", e); }

// ==========================================
// 4. SUPABASE SYNC LOGIC
// ==========================================
async function fetchAllSupabase() {
    if (!supabase) { renderAll(); return; }
    const dateEl = document.getElementById('bsb-date');
    if (dateEl) dateEl.textContent = 'Sincronizando...';

    const tables = ['pedidos', 'corte', 'costura', 'costurado', 'acabamento', 'reserva', 'reserva_saidas'];
    const setters = [
        v => dbPedidos = v, v => dbCorte = v, v => dbCostura = v, v => dbCosturado = v, 
        v => dbAcabamento = v, v => dbReserva = v, v => dbReservaSaidas = v
    ];

    try {
        for(let i=0; i<tables.length; i++) {
            const { data, error } = await supabase.from(tables[i]).select('*');
            if(!error && data && data.length > 0) setters[i](data);
        }
        const { data: oc } = await supabase.from('os_counters').select('*');
        if(oc && oc.length > 0) {
            dbOsCounters = {};
            oc.forEach(o => dbOsCounters[o.resp] = o.counter);
        }
    } catch (e) { console.error("Sync error:", e); }
    renderAll();
    updateClock();
}

function syncToSupabase(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    if (!supabase) return;
    const tableMap = { 'dbPedidos': 'pedidos', 'dbCorte': 'corte', 'dbCostura': 'costura', 'dbCosturado': 'costurado', 'dbAcabamento': 'acabamento', 'dbReserva': 'reserva', 'dbReservaSaidas': 'reserva_saidas' };
    const remota = tableMap[key];
    if(remota && data && data.length > 0) supabase.from(remota).upsert(data).then();
    if (key === 'dbOsCounters') {
        const arr = Object.keys(data).map(resp => ({ resp, counter: data[resp] }));
        if(arr.length > 0) supabase.from('os_counters').upsert(arr).then();
    }
}

function syncDeleteCascade(corte, cor, tam, startIdx) {
    if (!supabase) return;
    const tabelas = ['pedidos', 'corte', 'costura', 'costurado', 'acabamento', 'reserva'];
    for (let i = startIdx; i < tabelas.length; i++) supabase.from(tabelas[i]).delete().eq('corte', corte).eq('cor', cor).eq('tamanho', tam).then();
    if (startIdx <= 5) supabase.from('reserva_saidas').delete().eq('corte', corte).eq('cor', cor).eq('tamanho', tam).then();
}

// Iniciar busca
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', fetchAllSupabase);
else fetchAllSupabase();

function gerarOsParaResp(resp) {
    const inicial = resp.trim().charAt(0).toUpperCase();
    if (!dbOsCounters[resp]) dbOsCounters[resp] = 0;
    dbOsCounters[resp]++;
    syncToSupabase('dbOsCounters', dbOsCounters);
    const num = String(dbOsCounters[resp]).padStart(2, '0');
    return `${inicial}-${num}`;
}

function initFormDates() {
    const t = getBrasiliaTime();
    document.querySelectorAll('input[type="date"]').forEach(i => { if (!i.value) i.value = t.iso; });
}

// Navegação por abas principais
const tabs     = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        renderAll();
    });
});

// ==========================================
// ÁREA DO CHEFE
// ==========================================
const SENHA_MASTER = "Kemy";

window.acessarAreaChefe = () => {
    const pwd = document.getElementById('input-senha-chefe').value;
    if (pwd === SENHA_MASTER) {
        document.getElementById('chefe-login-guard').style.display = 'none';
        document.getElementById('chefe-dashboard').style.display  = 'block';
        document.getElementById('msg-erro-senha').style.display   = 'none';
        renderAll();
    } else {
        document.getElementById('msg-erro-senha').style.display = 'block';
    }
};
document.getElementById('input-senha-chefe').addEventListener('keypress', e => { if (e.key === 'Enter') acessarAreaChefe(); });

// ==========================================
// DELEÇÃO EM CASCATA INTELIGENTE POR MÓDULO
// ==========================================
// Níveis: pedido, corte, oficina, costurado, acabamento, reserva
// Deletar de um nível apaga DAQUELE nível em diante
// Deletar do Corte = apaga TUDO (incluindo pedido)
window.deletarCascade = (corte, cor, tam, nivel) => {
    const nomeNiveis = {
        'pedido':     'PEDIDO (tudo)',
        'corte':      'CORTE (apaga tudo)',
        'oficina':    'OFICINA → frente',
        'costurado':  'COSTURADO → frente',
        'acabamento': 'ACABAMENTO → frente',
        'reserva':    'RESERVA (só reserva)'
    };
    if (!confirm(`ATENÇÃO CHEFE: Apagar "${nomeNiveis[nivel] || nivel}" do Lote N° ${corte} [${cor}] Tam ${tam}?\n\nIsso remove do módulo selecionado em diante.`)) return;
    
    const filtro = x => !(x.corte === corte && x.cor === cor && x.tamanho === tam);
    const levels = ['pedido', 'corte', 'oficina', 'costurado', 'acabamento', 'reserva'];
    const startIdx = levels.indexOf(nivel);
    
    // Corte = apaga tudo incluindo pedido
    if (startIdx <= 0) dbPedidos       = dbPedidos.filter(filtro);
    if (startIdx <= 1) dbCorte         = dbCorte.filter(filtro);
    if (startIdx <= 2) dbCostura       = dbCostura.filter(filtro);
    if (startIdx <= 3) dbCosturado     = dbCosturado.filter(filtro);
    if (startIdx <= 4) dbAcabamento    = dbAcabamento.filter(filtro);
    if (startIdx <= 5) {
        dbReserva       = dbReserva.filter(filtro);
        dbReservaSaidas = dbReservaSaidas.filter(filtro);
    }
    
    
    // Sincroniza exclusão no Supabase
    syncDeleteCascade(corte, cor, tam, startIdx);
    
    ['dbPedidos','dbCorte','dbCostura','dbCosturado','dbAcabamento','dbReserva','dbReservaSaidas'].forEach(k =>
        syncToSupabase(k, eval(k))
    );
    renderAll();
};

// Chefe: Lançar Pedido Multi-Cores (com Tamanho por linha)
document.getElementById('form-pedido').addEventListener('submit', e => {
    e.preventDefault();
    const dt = document.getElementById('ped-data').value;
    const ct = document.getElementById('ped-corte').value.trim();
    const rf = document.getElementById('ped-ref').value.trim();
    const coresInputs = document.querySelectorAll('input[name="ped-cor[]"]');
    const qtdsInputs  = document.querySelectorAll('input[name="ped-qtd[]"]');
    const tamsInputs  = document.querySelectorAll('select[name="ped-tam[]"]');
    const tc = document.getElementById('ped-tecido').value.trim() || 'N/A';
    let criados = 0;
    for (let i = 0; i < coresInputs.length; i++) {
        const cor = coresInputs[i].value.trim();
        const qtd = parseInt(qtdsInputs[i].value);
        const tam = tamsInputs[i]?.value || '';
        if (cor && qtd > 0 && tam) {
            dbPedidos.push({ id: Date.now().toString()+"_"+i, data_pedido: dt, corte: ct, ref: rf, cor, tamanho: tam, qtd_solicitada: qtd, cortado: false, tecido: tc });
            criados++;
        }
    }
    if (criados > 0) {
        syncToSupabase('dbPedidos', dbPedidos);
        document.getElementById('container-cores-pedido').innerHTML = `
            <div class="linha-cor-qtd">
                <input type="text" name="ped-cor[]" placeholder="Cor" required style="flex:2;">
                <input type="number" name="ped-qtd[]" placeholder="Qtd" min="1" required style="flex:1;">
                <select name="ped-tam[]" required style="flex:1;"><option value="">Tam</option><option value="10">10</option><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="P">P</option><option value="M">M</option><option value="G">G</option><option value="GG">GG</option><option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option></select>
                <button type="button" class="btn btn-remover" onclick="this.parentElement.remove()" style="visibility:hidden;">X</button>
            </div>`;
        e.target.reset(); renderAll();
        alert(`Pedido lancado em ${criados} cor(es).`);
    } else { alert("Preencha ao menos uma cor e quantidade."); }
});

// Chefe: Injeção Costurado
document.getElementById('form-injetar-estc')?.addEventListener('submit', e => {
    e.preventDefault();
    const dt = document.getElementById('inj-estc-data').value;
    const ct = document.getElementById('inj-estc-corte').value.trim();
    const rf = document.getElementById('inj-estc-ref').value.trim();
    const tc = document.getElementById('inj-estc-tecido').value.trim() || 'N/A';
    const fl = document.getElementById('inj-estc-folha').value.trim() || '0';
    const obs = document.getElementById('inj-estc-obs').value.trim();
    const coresInputs = document.querySelectorAll('input[name="inj-estc-cor[]"]');
    const qtdsInputs  = document.querySelectorAll('input[name="inj-estc-qtd[]"]');
    const tamsInputs  = document.querySelectorAll('select[name="inj-estc-tam[]"]');
    let criados = 0;
    for (let i = 0; i < coresInputs.length; i++) {
        const cor = coresInputs[i].value.trim();
        const qtd = parseInt(qtdsInputs[i].value);
        const tam = tamsInputs[i]?.value || '';
        if (cor && qtd > 0 && tam) {
            dbCosturado.push({ id: Date.now().toString()+"_"+i, costuraId:'DiretoChefe',
                corte: ct, ref: rf, cor, tamanho: tam, dataChegada: dt,
                saldoAtual: qtd, recOriginal: qtd, tecido: tc, folhas: fl, obs
            });
            criados++;
        }
    }
    if (criados > 0) {
        syncToSupabase('dbCosturado', dbCosturado);
        document.getElementById('container-linhas-estc').innerHTML = `
            <div class="linha-cor-qtd">
                <input type="text" name="inj-estc-cor[]" placeholder="Cor" required style="flex:2;">
                <input type="number" name="inj-estc-qtd[]" placeholder="Qtd" min="1" required style="flex:1;">
                <select name="inj-estc-tam[]" required style="flex:1;"><option value="">Tam</option><option value="10">10</option><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="P">P</option><option value="M">M</option><option value="G">G</option><option value="GG">GG</option><option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option></select>
                <button type="button" class="btn btn-remover" onclick="this.parentElement.remove()" style="visibility:hidden;">X</button>
            </div>`;
        e.target.reset(); renderAll(); alert(`Registrado no Costurado: ${criados} linha(s)!`);
    } else { alert("Preencha ao menos uma linha."); }
});

// Chefe: Injeção Acabamento
document.getElementById('form-injetar-acab')?.addEventListener('submit', e => {
    e.preventDefault();
    const dt = document.getElementById('inj-acab-data').value;
    const ct = document.getElementById('inj-acab-corte').value.trim();
    const rf = document.getElementById('inj-acab-ref').value.trim();
    const tc = document.getElementById('inj-acab-tecido').value.trim() || 'N/A';
    const fl = document.getElementById('inj-acab-folha').value.trim() || '0';
    const os = document.getElementById('inj-acab-os').value.trim();
    const obs = document.getElementById('inj-acab-obs').value.trim();
    const coresInputs = document.querySelectorAll('input[name="inj-acab-cor[]"]');
    const qtdsInputs  = document.querySelectorAll('input[name="inj-acab-qtd[]"]');
    const tamsInputs  = document.querySelectorAll('select[name="inj-acab-tam[]"]');
    let criados = 0;
    for (let i = 0; i < coresInputs.length; i++) {
        const cor = coresInputs[i].value.trim();
        const qtd = parseInt(qtdsInputs[i].value);
        const tam = tamsInputs[i]?.value || '';
        if (cor && qtd > 0 && tam) {
            dbAcabamento.push({ id: Date.now().toString()+"_"+i,
                corte: ct, ref: rf, cor, tamanho: tam,
                origem: 'Injecao Direta (Chefe)', dataEmissao: dt,
                qtdRecebida: qtd, status: 'Em Processo',
                osGerada: os, resp: 'SISTEMA/EXTERNO',
                dataInicio: dt, dataFim: '', qtdSP: 0, qtdReserva: 0,
                tecido: tc, folhas: fl, obs, marca: ''
            });
            criados++;
        }
    }
    if (criados > 0) {
        syncToSupabase('dbAcabamento', dbAcabamento);
        document.getElementById('container-linhas-acab').innerHTML = `
            <div class="linha-cor-qtd">
                <input type="text" name="inj-acab-cor[]" placeholder="Cor" required style="flex:2;">
                <input type="number" name="inj-acab-qtd[]" placeholder="Qtd" min="1" required style="flex:1;">
                <select name="inj-acab-tam[]" required style="flex:1;"><option value="">Tam</option><option value="10">10</option><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="P">P</option><option value="M">M</option><option value="G">G</option><option value="GG">GG</option><option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option></select>
                <button type="button" class="btn btn-remover" onclick="this.parentElement.remove()" style="visibility:hidden;">X</button>
            </div>`;
        e.target.reset(); renderAll(); alert(`Registrado no Acabamento: ${criados} linha(s)!`);
    } else { alert("Preencha ao menos uma linha."); }
});

// Chefe: Injeção Reserva
document.getElementById('form-injetar-reserva')?.addEventListener('submit', e => {
    e.preventDefault();
    const dt = document.getElementById('inj-res-data').value;
    const ct = document.getElementById('inj-res-corte').value.trim();
    const rf = document.getElementById('inj-res-ref').value.trim();
    const tc = document.getElementById('inj-res-tecido').value.trim() || 'N/A';
    const fl = document.getElementById('inj-res-folha').value.trim() || '0';
    const obs = document.getElementById('inj-res-obs').value.trim();
    const coresInputs = document.querySelectorAll('input[name="inj-res-cor[]"]');
    const qtdsInputs  = document.querySelectorAll('input[name="inj-res-qtd[]"]');
    const tamsInputs  = document.querySelectorAll('select[name="inj-res-tam[]"]');
    let criados = 0;
    for (let i = 0; i < coresInputs.length; i++) {
        const cor = coresInputs[i].value.trim();
        const qtd = parseInt(qtdsInputs[i].value);
        const tam = tamsInputs[i]?.value || '';
        if (cor && qtd > 0 && tam) {
            dbReserva.push({ id: Date.now().toString()+"_"+i, acabId:'DiretoChefe',
                corte: ct, ref: rf, cor, tamanho: tam, dataChegada: dt,
                saldoAtual: qtd, tecido: tc, folhas: fl, obs
            });
            criados++;
        }
    }
    if (criados > 0) {
        syncToSupabase('dbReserva', dbReserva);
        document.getElementById('container-linhas-res').innerHTML = `
            <div class="linha-cor-qtd">
                <input type="text" name="inj-res-cor[]" placeholder="Cor" required style="flex:2;">
                <input type="number" name="inj-res-qtd[]" placeholder="Qtd" min="1" required style="flex:1;">
                <select name="inj-res-tam[]" required style="flex:1;"><option value="">Tam</option><option value="10">10</option><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="P">P</option><option value="M">M</option><option value="G">G</option><option value="GG">GG</option><option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option></select>
                <button type="button" class="btn btn-remover" onclick="this.parentElement.remove()" style="visibility:hidden;">X</button>
            </div>`;
        e.target.reset(); renderAll(); alert(`Registrado no Estoque Reserva: ${criados} linha(s)!`);
    } else { alert("Preencha ao menos uma linha."); }
});

// Helper de Injeção Chefe (Nova Linha)
window.adicionarLinhaInj = (containerId, prefix) => {
    const div = document.createElement('div');
    div.className = 'linha-cor-qtd';
    div.innerHTML = `
        <input type="text" name="${prefix}-cor[]" placeholder="Cor" required style="flex:2;">
        <input type="number" name="${prefix}-qtd[]" placeholder="Qtd" min="1" required style="flex:1;">
        <select name="${prefix}-tam[]" required style="flex:1;"><option value="">Tam</option><option value="10">10</option><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="P">P</option><option value="M">M</option><option value="G">G</option><option value="GG">GG</option><option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option></select>
        <button type="button" class="btn btn-remover" onclick="this.parentElement.remove()">X</button>
    `;
    document.getElementById(containerId).appendChild(div);
};

// ==========================================
// HELPERS DE SELECTS
// ==========================================
function getSaldoCorte(idCorte) {
    const c = dbCorte.find(x => x.id === idCorte);
    if (!c) return 0;
    const env = dbCostura.filter(s => s.corteId === idCorte).reduce((a, x) => a + x.enviada, 0);
    return c.qtdReal - env;
}

function getOpcoesAcabamentoPendente() {
    return dbAcabamento.filter(a => a.status === 'Pendente')
        .map(a => `<option value="${a.id}">N° ${a.corte} [${a.cor}] Saldo: ${a.qtdRecebida}</option>`)
        .join('');
}

function atualizarSelectsPuxada() {
    // Lista de pedidos pendentes — AGRUPADOS POR REFERÊNCIA
    const tPed = document.querySelector('#tabela-pedidos-lateral tbody');
    if (tPed) {
        tPed.innerHTML = '';
        const pendentes = dbPedidos.filter(p => !p.cortado);
        const byRef = {};
        pendentes.forEach(p => {
            if (!byRef[p.ref]) byRef[p.ref] = [];
            byRef[p.ref].push(p);
        });
        Object.keys(byRef).sort().forEach(ref => {
            const items = byRef[ref];
            // Cabeçalho de grupo por referência
            tPed.innerHTML += `<tr class="ref-group-header"><td colspan="6">Ref: ${ref} (${items.length} corte${items.length > 1 ? 's' : ''})</td></tr>`;
            items.forEach(p => {
                tPed.innerHTML += `<tr><td>${p.data_pedido}</td><td><b>${p.corte}</b></td><td>${p.tamanho}</td><td>${p.ref}/<b style="color:var(--danger)">${p.cor}</b></td><td><b style="color:var(--primary)">${p.qtd_solicitada}</b></td><td>${p.tecido||'--'}</td></tr>`;
            });
        });
    }

    // Select envio oficina
    const selOfi = document.getElementById('ofi-busca-corte-select');
    if (selOfi) {
        selOfi.innerHTML = '<option value="">Selecione</option>';
        dbCorte.forEach(c => {
            const saldo = getSaldoCorte(c.id);
            if (saldo > 0) selOfi.innerHTML += `<option value="${c.id}">N° ${c.corte} [${c.cor}] - ${c.ref} Disp: ${saldo}</option>`;
        });
        selOfi.onchange = e => {
            const s = getSaldoCorte(e.target.value);
            const el = document.getElementById('ofi-env-qtd');
            el.max = s; if (e.target.value) el.value = s;
        };
    }

    // Select costurado
    const selEstc = document.getElementById('estc-lote-select');
    if (selEstc) {
        selEstc.innerHTML = '<option value="">Selecione...</option>';
        dbCosturado.filter(c => c.saldoAtual > 0).forEach(c => {
            selEstc.innerHTML += `<option value="${c.id}">N° ${c.corte} [${c.cor}] Disp: ${c.saldoAtual}</option>`;
        });
        selEstc.onchange = e => {
            const item = dbCosturado.find(x => x.id === e.target.value);
            if (item) { document.getElementById('estc-qtd').max = item.saldoAtual; document.getElementById('estc-qtd').value = item.saldoAtual; }
        };
    }

    // Selects dinâmicos de lote no Acabamento
    document.querySelectorAll('select[name="aca-lote-id[]"]').forEach(sel => {
        const val = sel.value;
        sel.innerHTML = '<option value="">Selecione o Lote Pendente</option>' + getOpcoesAcabamentoPendente();
        if (val) sel.value = val;
    });
}

// ==========================================
// CORTE: DROPDOWN DINÂMICO DE CORES
// ==========================================
const buscaCorteNum = document.getElementById('cor-busca-manual');
if (buscaCorteNum) {
    const checkMatching = () => {
        const n = buscaCorteNum.value.trim().toLowerCase();
        const suggBox = document.getElementById('cor-sugestoes');
        suggBox.innerHTML = '';
        ['cor-hide-id','cor-auto-ref','cor-auto-tam','cor-auto-req'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('cor-qtd-real').disabled    = true;
        document.getElementById('cor-data-pronto').disabled = true;
        document.getElementById('cor-btn-submit').disabled  = true;
        document.getElementById('cor-msg-erro').style.display = 'none';
        if (!n) return;

        const matches = dbPedidos.filter(p => !p.cortado && p.corte.toString().toLowerCase() === n);
        if (matches.length > 0) {
            matches.forEach(m => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn cor-btn-sugestao';
                btn.innerHTML = `Cor: <b>${m.cor}</b> &nbsp;|&nbsp; Falta Cortar: <b>${m.qtd_solicitada}</b> pts &nbsp;|&nbsp; Tam: ${m.tamanho}`;
                btn.onclick = () => {
                    document.getElementById('cor-hide-id').value   = m.id;
                    document.getElementById('cor-auto-ref').value  = m.ref + " / " + m.cor;
                    document.getElementById('cor-auto-tam').value  = m.tamanho;
                    document.getElementById('cor-auto-req').value  = m.qtd_solicitada;
                    document.getElementById('cor-qtd-real').disabled    = false;
                    document.getElementById('cor-data-pronto').disabled = false;
                    document.getElementById('cor-folha').disabled       = false;
                    document.getElementById('cor-qtd-real').max    = m.qtd_solicitada;
                    document.getElementById('cor-btn-submit').disabled  = false;
                    suggBox.innerHTML = `<div style="background:#d1fae5;color:#065f46;padding:10px;border-radius:6px;font-weight:bold;border:1px solid #34d399;margin-top:5px;">Cor "${m.cor}" selecionada. Preencha data, qtd e folhas abaixo.</div>`;
                };
                suggBox.appendChild(btn);
            });
        } else {
            document.getElementById('cor-msg-erro').style.display = 'block';
        }
    };
    buscaCorteNum.addEventListener('input', checkMatching);
}

// ==========================================
// FLUXOS OPERACIONAIS
// ==========================================

// 2. CORTE
document.getElementById('form-corte').addEventListener('submit', e => {
    e.preventDefault();
    const pId = document.getElementById('cor-hide-id').value;
    const p   = dbPedidos.find(x => x.id === pId);
    const qtd = parseInt(document.getElementById('cor-qtd-real').value);
    const dt  = document.getElementById('cor-data-pronto').value;
    const fl  = document.getElementById('cor-folha').value.trim() || '0';
    p.qtd_solicitada -= qtd;
    if (p.qtd_solicitada <= 0) p.cortado = true;
    syncToSupabase('dbPedidos', dbPedidos);
    dbCorte.push({ id: Date.now().toString(), pedidoId: pId, corte: p.corte, ref: p.ref, cor: p.cor, tamanho: p.tamanho, dataTrabalhado: dt, qtdReal: qtd, tecido: p.tecido || 'N/A', folhas: fl });
    syncToSupabase('dbCorte', dbCorte);
    e.target.reset();
    document.getElementById('cor-busca-manual').value   = '';
    document.getElementById('cor-sugestoes').innerHTML  = '';
    document.getElementById('cor-msg-erro').style.display = 'none';
    document.getElementById('cor-qtd-real').disabled    = true;
    document.getElementById('cor-data-pronto').disabled = true;
    document.getElementById('cor-btn-submit').disabled  = true;
    renderAll();
});

// 3. OFICINA (Ida) — com campo Nome
document.getElementById('form-oficina-envio').addEventListener('submit', e => {
    e.preventDefault();
    const cId = document.getElementById('ofi-busca-corte-select').value;
    const c   = dbCorte.find(x => x.id === cId);
    const nome = document.getElementById('ofi-env-nome').value.trim();
    dbCostura.push({ id: Date.now().toString(), corteId: cId, corte: c.corte, ref: c.ref, cor: c.cor, tamanho: c.tamanho,
        dataEnvio: document.getElementById('ofi-env-data').value,
        enviada: parseInt(document.getElementById('ofi-env-qtd').value),
        nome: nome,
        status: 'Enviado', devolvida: 0, descarte: 0, faltaReal: 0, dataRetorno: '', irAca: 0, irEstc: 0,
        tecido: c.tecido, folhas: c.folhas });
    syncToSupabase('dbCostura', dbCostura);
    e.target.reset(); renderAll();
});

// OFICINA (Retorno modal) — com suporte a devolução parcial
window.abrirModalDevolucao = id => {
    const c = dbCostura.find(x => x.id === id);
    document.getElementById('modal-dev-id').value          = id;
    document.getElementById('modal-dev-show-corte').textContent = c.corte;
    document.getElementById('modal-dev-show-env').textContent   = c.enviada;
    document.getElementById('modal-dev-qtd').value  = c.enviada;
    document.getElementById('modal-dev-desc').value = 0;
    const qR = document.getElementById('modal-dev-qtd');
    const dR = document.getElementById('modal-dev-desc');
    const aA = document.getElementById('modal-dev-para-acab');
    const aC = document.getElementById('modal-dev-para-estc');
    const upd = () => {
        const rec = parseInt(qR.value)||0;
        const desc = parseInt(dR.value)||0;
        const disp = rec - desc;
        const continua = c.enviada - rec;
        const contBox = document.getElementById('modal-dev-continua-box');
        document.getElementById('modal-dev-continua').textContent = continua > 0 ? continua : 0;
        contBox.style.display = continua > 0 ? 'block' : 'none';
        document.getElementById('modal-dev-disponivel').textContent = disp > 0 ? disp : 0;
        aA.value = disp > 0 ? disp : 0; aC.value = 0;
    };
    qR.oninput = upd; dR.oninput = upd;
    aA.oninput = () => { const d = parseInt(document.getElementById('modal-dev-disponivel').textContent); aC.value = d - (parseInt(aA.value)||0); };
    aC.oninput = () => { const d = parseInt(document.getElementById('modal-dev-disponivel').textContent); aA.value = d - (parseInt(aC.value)||0); };
    upd();
    document.getElementById('modal-devolucao').style.display = 'flex';
};
window.fecharModalDevolucao = () => document.getElementById('modal-devolucao').style.display = 'none';

document.getElementById('form-devolucao-modal').addEventListener('submit', e => {
    e.preventDefault();
    const id  = document.getElementById('modal-dev-id').value;
    const idx = dbCostura.findIndex(x => x.id === id);
    const originalEnviada = dbCostura[idx].enviada;
    const rec  = parseInt(document.getElementById('modal-dev-qtd').value);
    const desc = parseInt(document.getElementById('modal-dev-desc').value);
    const irAca  = parseInt(document.getElementById('modal-dev-para-acab').value) || 0;
    const irEstc = parseInt(document.getElementById('modal-dev-para-estc').value) || 0;
    const livre  = rec - desc;
    const continua = originalEnviada - rec;
    if ((irAca + irEstc) !== livre) return alert("Soma diferente do Liquido Disponivel.");
    Object.assign(dbCostura[idx], { status:'Concluido', devolvida:rec, descarte:desc, faltaReal:0,
        dataRetorno: document.getElementById('modal-dev-data-retorno').value, irAca, irEstc });
    // Se houve devolução parcial, criar nova entrada para o que continua na oficina
    if (continua > 0) {
        dbCostura.push({ id: Date.now().toString()+'_rem', corteId: dbCostura[idx].corteId,
            corte: dbCostura[idx].corte, ref: dbCostura[idx].ref, cor: dbCostura[idx].cor,
            tamanho: dbCostura[idx].tamanho, dataEnvio: dbCostura[idx].dataEnvio,
            nome: dbCostura[idx].nome, enviada: continua,
            status:'Enviado', devolvida:0, descarte:0, faltaReal:0, dataRetorno:'', irAca:0, irEstc:0,
            tecido: dbCostura[idx].tecido, folhas: dbCostura[idx].folhas });
    }
    syncToSupabase('dbCostura', dbCostura);
    if (irEstc > 0) {
        dbCosturado.push({ id: Date.now().toString(), costuraId: id, corte: dbCostura[idx].corte,
            ref: dbCostura[idx].ref, cor: dbCostura[idx].cor, tamanho: dbCostura[idx].tamanho,
            dataChegada: dbCostura[idx].dataRetorno, saldoAtual: irEstc, recOriginal: irEstc,
            tecido: dbCostura[idx].tecido, folhas: dbCostura[idx].folhas });
        syncToSupabase('dbCosturado', dbCosturado);
    }
    if (irAca > 0) {
        dbAcabamento.push({ id: Date.now().toString(), corte: dbCostura[idx].corte, ref: dbCostura[idx].ref,
            cor: dbCostura[idx].cor, tamanho: dbCostura[idx].tamanho,
            origem:'Direto da Oficina', dataEmissao: dbCostura[idx].dataRetorno,
            qtdRecebida: irAca, status:'Pendente', osGerada:'', resp:'', dataInicio:'', dataFim:'', qtdSP:0, qtdReserva:0,
            tecido: dbCostura[idx].tecido, folhas: dbCostura[idx].folhas });
        syncToSupabase('dbAcabamento', dbAcabamento);
    }
    fecharModalDevolucao(); e.target.reset(); renderAll();
});

// 4. COSTURADO -> ACABAMENTO
document.getElementById('form-costurado-saida').addEventListener('submit', e => {
    e.preventDefault();
    const idx = dbCosturado.findIndex(x => x.id === document.getElementById('estc-lote-select').value);
    const q   = parseInt(document.getElementById('estc-qtd').value);
    if (q > dbCosturado[idx].saldoAtual) return alert("Qtd superior ao saldo.");
    dbCosturado[idx].saldoAtual -= q;
    syncToSupabase('dbCosturado', dbCosturado);
    dbAcabamento.push({ id: Date.now().toString(), corte: dbCosturado[idx].corte, ref: dbCosturado[idx].ref,
        cor: dbCosturado[idx].cor, tamanho: dbCosturado[idx].tamanho,
        origem:'Estoque Costurado', dataEmissao: document.getElementById('estc-data').value,
        qtdRecebida: q, status:'Pendente', osGerada:'',
        tecido: dbCosturado[idx].tecido, folhas: dbCosturado[idx].folhas });
    syncToSupabase('dbAcabamento', dbAcabamento);
    e.target.reset(); renderAll();
});

// 5. ACABAMENTO MULTI-LOTE
// Sincronizar selects para evitar duplicatas
window.sincronizarSelectsAcabamento = () => {
    const selects = document.querySelectorAll('select[name="aca-lote-id[]"]');
    const selectedValues = new Set();
    selects.forEach(sel => { if (sel.value) selectedValues.add(sel.value); });
    selects.forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">Selecione o Lote Pendente</option>';
        dbAcabamento.filter(a => a.status === 'Pendente').forEach(a => {
            if (!selectedValues.has(a.id) || a.id === currentVal)
                sel.innerHTML += `<option value="${a.id}" ${a.id===currentVal?'selected':''}>N° ${a.corte} [${a.cor}] Saldo: ${a.qtdRecebida}</option>`;
        });
    });
};

window.adicionarLinhaLoteAca = () => {
    const div = document.createElement('div');
    div.className = 'linha-lote-aca';
    div.innerHTML = `
        <select name="aca-lote-id[]" required onchange="atualizarMaxQtdAca(this); sincronizarSelectsAcabamento();">
            <option value="">Selecione o Lote Pendente</option>
            ${getOpcoesAcabamentoPendente()}
        </select>
        <input type="number" name="aca-lote-qtd[]" placeholder="Qtd" min="1" required>
        <button type="button" class="btn-remover" onclick="this.parentElement.remove(); sincronizarSelectsAcabamento();">X</button>`;
    document.getElementById('container-lotes-acabamento').appendChild(div);
    sincronizarSelectsAcabamento();
};

window.atualizarMaxQtdAca = sel => {
    const lote = dbAcabamento.find(x => x.id === sel.value);
    const qtdEl = sel.parentElement.querySelector('input[name="aca-lote-qtd[]"]');
    if (lote && qtdEl) { qtdEl.max = lote.qtdRecebida; qtdEl.value = lote.qtdRecebida; }
};

document.getElementById('form-acabamento-inicio').addEventListener('submit', e => {
    e.preventDefault();
    const resp       = document.getElementById('aca-resp').value.trim();
    const marca      = document.getElementById('aca-marca')?.value.trim() || '';
    const dataInicio = document.getElementById('aca-data-inicio').value;
    const loteSelects = document.querySelectorAll('select[name="aca-lote-id[]"]');
    const loteQtds    = document.querySelectorAll('input[name="aca-lote-qtd[]"]');

    // Coletar lotes válidos primeiro (sem modificar o DB ainda)
    const lotesValidos = [];
    for (let i = 0; i < loteSelects.length; i++) {
        const idList = loteSelects[i].value;
        if (!idList) continue;
        const qTrabalho = parseInt(loteQtds[i].value);
        const pIdx = dbAcabamento.findIndex(x => x.id === idList);
        const pLot = dbAcabamento[pIdx];
        if (!pLot) continue;
        if (qTrabalho > pLot.qtdRecebida) { alert(`Qtd maior que saldo do lote ${pLot.corte} [${pLot.cor}].`); return; }
        lotesValidos.push({ i, idList, qTrabalho, pIdx, pLot });
    }
    if (lotesValidos.length === 0) return alert("Selecione ao menos um lote.");

    // Agora gerar OS sequencial para cada lote (em ordem)
    const tsBase = Date.now();
    lotesValidos.forEach(({ i, qTrabalho, pIdx, pLot }) => {
        const os = gerarOsParaResp(resp);
        pLot.qtdRecebida -= qTrabalho;
        if (pLot.qtdRecebida <= 0) {
            Object.assign(pLot, { status:'Em Processo', qtdRecebida: qTrabalho, dataInicio, resp, osGerada: os, marca });
        } else {
            dbAcabamento.push({
                id: (tsBase + i).toString(),
                corte: pLot.corte, ref: pLot.ref, cor: pLot.cor,
                tamanho: pLot.tamanho, origem: pLot.origem, dataEmissao: pLot.dataEmissao,
                qtdRecebida: qTrabalho, status:'Em Processo', osGerada: os,
                resp, dataInicio, dataFim:'', qtdSP:0, qtdReserva:0, marca,
                tecido: pLot.tecido, folhas: pLot.folhas
            });
        }
    });

    syncToSupabase('dbAcabamento', dbAcabamento);
    document.getElementById('container-lotes-acabamento').innerHTML = `
        <div class="linha-lote-aca">
            <select name="aca-lote-id[]" required onchange="atualizarMaxQtdAca(this); sincronizarSelectsAcabamento();"><option value="">Selecione o Lote Pendente</option></select>
            <input type="number" name="aca-lote-qtd[]" placeholder="Qtd" min="1" required>
            <button type="button" class="btn-remover" style="visibility:hidden;">X</button>
        </div>`;
    e.target.reset(); renderAll();
    alert(`${lotesValidos.length} OS criada(s) para ${resp}.`);
});

window.abrirModalAcab = id => {
    const a = dbAcabamento.find(x => x.id === id);
    document.getElementById('modal-acab-id').value          = id;
    document.getElementById('modal-acab-show-os').textContent   = a.osGerada;
    document.getElementById('modal-acab-show-resp').textContent = a.resp;
    document.getElementById('modal-acab-show-qtd').textContent  = a.qtdRecebida;
    const sp  = document.getElementById('aca-qtd-sp');
    const res = document.getElementById('aca-qtd-reserva');
    sp.max = a.qtdRecebida; sp.value = a.qtdRecebida;
    res.max = a.qtdRecebida; res.value = 0;
    sp.oninput  = () => { res.value = a.qtdRecebida - (parseInt(sp.value)||0); };
    res.oninput = () => { sp.value  = a.qtdRecebida - (parseInt(res.value)||0); };
    document.getElementById('modal-acabamento-fim').style.display = 'flex';
};
window.fecharModalAcab = () => document.getElementById('modal-acabamento-fim').style.display = 'none';

document.getElementById('form-acabamento-final').addEventListener('submit', e => {
    e.preventDefault();
    const id  = document.getElementById('modal-acab-id').value;
    const idx = dbAcabamento.findIndex(x => x.id === id);
    const qSP  = parseInt(document.getElementById('aca-qtd-sp').value)      || 0;
    const qRES = parseInt(document.getElementById('aca-qtd-reserva').value) || 0;
    const descricao = document.getElementById('aca-descricao-fim')?.value.trim() || '';
    if ((qSP + qRES) !== dbAcabamento[idx].qtdRecebida) return alert("Erro matematico: soma diferente da qtd da OS.");
    Object.assign(dbAcabamento[idx], { status:'Finalizado', dataFim: document.getElementById('aca-data-fim').value, qtdSP: qSP, qtdReserva: qRES, descricaoFinal: descricao });
    syncToSupabase('dbAcabamento', dbAcabamento);
    if (qRES > 0) {
        dbReserva.push({ id: Date.now().toString(), acabId: id, corte: dbAcabamento[idx].corte,
            ref: dbAcabamento[idx].ref, cor: dbAcabamento[idx].cor, tamanho: dbAcabamento[idx].tamanho,
            dataChegada: dbAcabamento[idx].dataFim, saldoAtual: qRES,
            tecido: dbAcabamento[idx].tecido, folhas: dbAcabamento[idx].folhas });
        syncToSupabase('dbReserva', dbReserva);
    }
    fecharModalAcab(); e.target.reset(); renderAll();
});

// 6. ESTOQUE RESERVA
window.abrirModalSaida = id => {
    const r = dbReserva.find(x => x.id === id);
    document.getElementById('srt-id-oculto').value         = id;
    document.getElementById('srt-show-corte').textContent  = `N° ${r.corte}`;
    document.getElementById('srt-show-ref').textContent    = `${r.ref} / ${r.cor}`;
    document.getElementById('srt-show-saldo').textContent  = `${r.saldoAtual} pts`;
    document.getElementById('srt-qtd').max   = r.saldoAtual;
    document.getElementById('srt-qtd').value = r.saldoAtual;
    document.getElementById('modal-saida-reserva').style.display = 'block';
};
window.fecharModalSaida = () => document.getElementById('modal-saida-reserva').style.display = 'none';

document.getElementById('form-saida-futura').addEventListener('submit', e => {
    e.preventDefault();
    const idx  = dbReserva.findIndex(x => x.id === document.getElementById('srt-id-oculto').value);
    const qSair = parseInt(document.getElementById('srt-qtd').value);
    dbReserva[idx].saldoAtual -= qSair;
    syncToSupabase('dbReserva', dbReserva);
    dbReservaSaidas.push({ id: Date.now().toString(), corte: dbReserva[idx].corte, ref: dbReserva[idx].ref,
        cor: dbReserva[idx].cor, tamanho: dbReserva[idx].tamanho,
        dataSaida: document.getElementById('srt-data').value,
        destino: document.getElementById('srt-destino').value,
        marca:   document.getElementById('srt-marca').value, qtdSaida: qSair,
        tecido: dbReserva[idx].tecido, folhas: dbReserva[idx].folhas });
    syncToSupabase('dbReservaSaidas', dbReservaSaidas);
    fecharModalSaida(); e.target.reset(); renderAll();
});


// ==========================================
// RENDERIZAÇÃO PRINCIPAL
// ==========================================
function renderAll() {
    initFormDates();
    atualizarSelectsPuxada();

    // Auditoria Chefe
    const tPerdas = document.querySelector('#tabela-auditoria-perdas tbody');
    if (tPerdas) {
        tPerdas.innerHTML = '';
        dbCostura.slice().reverse().forEach(o => {
            if (o.descarte > 0 || o.faltaReal > 0)
                tPerdas.innerHTML += `<tr><td>${o.dataRetorno}</td><td><b>${o.corte}</b></td><td>${o.ref}</td><td>${o.enviada}</td><td style="color:var(--danger)">${o.descarte}</td><td style="color:var(--danger)"><b>${o.faltaReal}</b></td></tr>`;
        });
    }
    const tAud = document.querySelector('#tabela-chefe-auditoria tbody');
    if (tAud) {
        tAud.innerHTML = '';
        const q = (document.getElementById('busca-chefe-auditoria')?.value || '').toLowerCase();
        let acts = [];
        // Mapeia módulo para nível de cascata
        dbPedidos.forEach(x    => acts.push({d:x.data_pedido,  s:'Pedido',     nivel:'pedido',     c:x.corte, ref:x.ref, cor:x.cor, tam:x.tamanho, q:x.qtd_solicitada, tc:x.tecido||'--', fl:'--'}));
        dbCorte.forEach(x      => acts.push({d:x.dataTrabalhado,s:'Corte',     nivel:'corte',      c:x.corte, ref:x.ref, cor:x.cor, tam:x.tamanho, q:x.qtdReal, tc:x.tecido||'--', fl:x.folhas||'--'}));
        dbCostura.forEach(x    => acts.push({d:x.dataEnvio,     s:'Oficina',   nivel:'oficina',    c:x.corte, ref:x.ref, cor:x.cor, tam:x.tamanho, q:x.enviada, tc:x.tecido||'--', fl:x.folhas||'--'}));
        dbCosturado.forEach(x  => acts.push({d:x.dataChegada,   s:'Costurado', nivel:'costurado',  c:x.corte, ref:x.ref, cor:x.cor, tam:x.tamanho, q:x.saldoAtual, tc:x.tecido||'--', fl:x.folhas||'--'}));
        dbAcabamento.forEach(x => acts.push({d:x.dataEmissao,   s:'Acabamento',nivel:'acabamento', c:x.corte, ref:x.ref, cor:x.cor, tam:x.tamanho, q:x.qtdRecebida, tc:x.tecido||'--', fl:x.folhas||'--'}));
        dbReserva.forEach(x    => acts.push({d:x.dataChegada,   s:'Reserva',   nivel:'reserva',    c:x.corte, ref:x.ref, cor:x.cor, tam:x.tamanho, q:x.saldoAtual, tc:x.tecido||'--', fl:x.folhas||'--'}));
        acts.sort((a,b)=>(b.d||'').localeCompare(a.d||'')).forEach(k => {
            if (!q || k.c.toLowerCase().includes(q) || k.ref.toLowerCase().includes(q))
                tAud.innerHTML += `<tr><td>${k.d}</td><td>${k.s}</td><td><b>${k.c}</b></td><td>${k.ref}</td><td>${k.cor}</td><td>${k.tam}</td><td>${k.q}</td><td>${k.tc}</td><td>${k.fl}</td><td><button class="btn btn-small" style="background:var(--danger-bg);color:var(--danger-text);" onclick="deletarCascade('${k.c}','${k.cor}','${k.tam}','${k.nivel}')">Excluir (${k.s}→)</button></td></tr>`;
        });
    }

    // Corte
    const tbCor = document.querySelector('#tabela-corte tbody');
    if (tbCor) { tbCor.innerHTML = ''; dbCorte.slice().reverse().forEach(t => { tbCor.innerHTML += `<tr><td>${t.dataTrabalhado}</td><td><b>${t.corte}</b></td><td>${t.ref}/${t.cor}</td><td>${t.tamanho}</td><td>${t.qtdReal}</td><td>${t.tecido||'--'}</td><td>${t.folhas||'0'}</td></tr>`; }); }

    // Oficina abertos — com Nome
    const tbOfi = document.querySelector('#tabela-oficina-abertos tbody');
    if (tbOfi) { tbOfi.innerHTML = ''; dbCostura.filter(c=>c.status==='Enviado').slice().reverse().forEach(c => { tbOfi.innerHTML += `<tr><td><b>${c.corte}</b></td><td>${c.ref} [${c.cor}]</td><td><b>${c.nome||'--'}</b></td><td>${c.enviada}</td><td>${c.tecido||'--'}</td><td>${c.folhas||'0'}</td><td>${c.dataEnvio}</td><td><button class="btn btn-small btn-success" onclick="abrirModalDevolucao('${c.id}')">Tratar Retorno</button></td></tr>`; }); }
    // Oficina histórico — com Nome
    const tOfiH = document.querySelector('#tabela-oficina-historico tbody');
    if (tOfiH) { tOfiH.innerHTML = ''; dbCostura.filter(c=>c.status==='Concluido').slice().reverse().forEach(c => { tOfiH.innerHTML += `<tr><td>${c.dataRetorno}</td><td><b>${c.corte}</b></td><td>${c.ref}</td><td><b>${c.nome||'--'}</b></td><td><b>${c.devolvida-c.descarte}</b></td><td>${c.tecido||'--'}</td><td>${c.folhas||'0'}</td><td>${(c.irAca||0) > 0 ? 'Acabamento':'Estoque'}</td></tr>`; }); }

    // Costurado
    const tbEstc = document.querySelector('#tabela-costurado tbody');
    if (tbEstc) { tbEstc.innerHTML = ''; dbCosturado.slice().reverse().forEach(t => { tbEstc.innerHTML += `<tr><td>${t.dataChegada}</td><td><b>${t.corte}</b></td><td>${t.ref}/${t.cor}</td><td>${t.tamanho}</td><td>${t.tecido||'--'}</td><td>${t.folhas||'0'}</td><td><b style="color:var(--primary)">${t.saldoAtual}</b></td></tr>`; }); }
    const tbEstcH = document.querySelector('#tabela-costurado-historico tbody');
    if (tbEstcH) {
        tbEstcH.innerHTML = '';
        let h = [];
        dbCosturado.forEach(c => h.push({d:c.dataChegada, t:'<span class="badge" style="background:#dbeafe;color:#1e40af;">ENTROU</span>', c:c.corte, r:`${c.ref}/${c.cor}`, tam:c.tamanho, tc:c.tecido, fl:c.folhas, v:`+${c.recOriginal}`}));
        dbAcabamento.filter(a=>a.origem==='Estoque Costurado').forEach(a => h.push({d:a.dataEmissao, t:'<span class="badge" style="background:#fee2e2;color:#991b1b;">SAIU</span>', c:a.corte, r:`${a.ref}/${a.cor}`, tam:a.tamanho, tc:a.tecido, fl:a.folhas, v:`-${a.qtdRecebida}`}));
        h.sort((a,b)=>b.d.localeCompare(a.d)).forEach(x => { tbEstcH.innerHTML += `<tr><td>${x.d}</td><td>${x.t}</td><td><b>${x.c}</b></td><td>${x.r}</td><td>${x.tam}</td><td>${x.tc||'--'}</td><td>${x.fl||'0'}</td><td>${x.v}</td></tr>`; });
    }

    // Acabamento em andamento — ordena por osGerada para manter ordem lógica
    const tbAca = document.querySelector('#tabela-acabamento-emandamento tbody');
    if (tbAca) {
        tbAca.innerHTML = '';
        const emProcesso = dbAcabamento
            .filter(a => a.status === 'Em Processo')
            .slice()
            .sort((a, b) => {
                if (a.osGerada < b.osGerada) return -1;
                if (a.osGerada > b.osGerada) return 1;
                return 0;
            });
        emProcesso.forEach(a => {
            tbAca.innerHTML += `<tr><td><b style="color:var(--warning-text)">${a.osGerada}</b></td><td>${a.resp}</td><td>${a.marca||'--'}</td><td><b>${a.corte} [${a.cor}]</b> / ${a.qtdRecebida} pts</td><td>${a.tecido||'--'}</td><td>${a.folhas||'0'}</td><td><button class="btn btn-small" style="background:var(--success);color:white;" onclick="abrirModalAcab('${a.id}')">Encerrar</button></td></tr>`;
        });
    }
    // Acabamento histórico
    const tAcaH = document.querySelector('#tabela-acabamento-historico tbody');
    if (tAcaH) { tAcaH.innerHTML = ''; dbAcabamento.filter(a=>a.status==='Finalizado').slice().reverse().forEach(a => { tAcaH.innerHTML += `<tr><td>${a.dataFim}</td><td><b>${a.osGerada}</b></td><td><b>${a.corte}</b> [${a.cor}] ${a.ref}</td><td>${a.resp}</td><td>${a.marca||'--'}</td><td>${a.tecido||'--'}</td><td>${a.folhas||'0'}</td><td style="color:#be185d">${a.qtdSP}</td><td style="color:#1d4ed8">${a.qtdReserva}</td><td>${a.descricaoFinal||a.obs||'--'}</td></tr>`; }); }

    // Estoque Reserva
    const tblResA = document.querySelector('#tabela-reserva-atual tbody');
    if (tblResA) { tblResA.innerHTML = ''; dbReserva.filter(r=>r.saldoAtual>0).forEach(r => { tblResA.innerHTML += `<tr><td>${r.dataChegada}</td><td><b>${r.corte}</b></td><td>${r.ref}/${r.cor}</td><td>${r.tamanho}</td><td>${r.tecido||'--'}</td><td>${r.folhas||'0'}</td><td><b style="font-size:16px">${r.saldoAtual}</b></td><td><button class="btn btn-small btn-primary" onclick="abrirModalSaida('${r.id}')">Despachar</button></td></tr>`; }); }
    const tblResB = document.querySelector('#tabela-reserva-extrato tbody');
    if (tblResB) {
        tblResB.innerHTML = '';
        let hRes = [];
        dbReserva.forEach(r => hRes.push({d:r.dataChegada, t:'<span class="badge" style="background:var(--success-bg);color:var(--success-text)">ENTROU</span>', c:r.corte, ref:`${r.ref}/${r.cor}`, tc:r.tecido, fl:r.folhas, qtd:r.saldoAtual, m:'--', dest:'Deposito'}));
        dbReservaSaidas.forEach(s => hRes.push({d:s.dataSaida, t:'<span class="badge" style="background:var(--danger-bg);color:var(--danger-text)">SAIU</span>', c:s.corte, ref:`${s.ref}/${s.cor}`, tc:s.tecido, fl:s.folhas, qtd:s.qtdSaida, m:`<b>${s.marca}</b>`, dest:s.destino}));
        hRes.sort((a,b)=>b.d.localeCompare(a.d)).forEach(h => { tblResB.innerHTML += `<tr><td>${h.d}</td><td>${h.t}</td><td><b>${h.c}</b></td><td>${h.ref}</td><td>${h.tc||'--'}</td><td>${h.fl||'0'}</td><td>${h.qtd}</td><td>${h.m}</td><td>${h.dest}</td></tr>`; });
    }

    // Enviados
    const tblEnv = document.querySelector('#tabela-aba-enviados tbody');
    if (tblEnv) {
        tblEnv.innerHTML = '';
        let total = 0, rows = [];
        dbAcabamento.filter(x=>x.status==='Finalizado'&&x.qtdSP>0).forEach(a => { total+=a.qtdSP; rows.push(`<tr><td>${a.dataFim}</td><td>Acabamento</td><td><b>${a.corte}</b></td><td>Matrizes</td><td>--</td><td>${a.ref}/${a.cor}</td><td>${a.tecido||'--'}</td><td><b>${a.qtdSP}</b></td></tr>`); });
        dbReservaSaidas.forEach(s => { total+=s.qtdSaida; rows.push(`<tr><td>${s.dataSaida}</td><td>Estoque Reserva</td><td><b>${s.corte}</b></td><td>${s.destino}</td><td>${s.marca}</td><td>${s.ref}/${s.cor}</td><td>${s.tecido||'--'}</td><td><b>${s.qtdSaida}</b></td></tr>`); });
        rows.forEach(r => tblEnv.innerHTML += r);
        document.getElementById('total-mega-enviados').textContent = total + " Peças";
    }

    renderRelatorios();
}

document.getElementById('busca-chefe-auditoria')?.addEventListener('input', renderAll);

// ==========================================
// RASTREABILIDADE GERAL
// ==========================================
document.getElementById('rast-input-corte').addEventListener('keypress', e => { if (e.key==='Enter') buscarRastreabilidade(); });
document.getElementById('rast-btn-buscar').addEventListener('click', buscarRastreabilidade);

function buscarRastreabilidade() {
    const num = document.getElementById('rast-input-corte').value.trim().toLowerCase();
    if (!num) return;
    const tl = document.getElementById('rast-timeline');
    tl.innerHTML = ''; tl.style.display = 'block';
    const ri = (title, meta, type='default') => { tl.innerHTML += `<div class="timeline-item ${type}"><h4>${title}</h4><p>${meta}</p></div>`; };

    dbPedidos.filter(x=>x.corte.toString().toLowerCase()===num).forEach(p => ri(`Pedido [Cor: ${p.cor}]`,`Data: ${p.data_pedido} | Tecido: ${p.tecido||'--'} | Qtd: ${p.qtd_solicitada} | Status: ${p.cortado?'Cortado':'Pendente'}`,'success'));
    dbCorte.filter(x=>x.corte.toString().toLowerCase()===num).forEach(c => ri(`Corte [Cor: ${c.cor}]`,`Data: ${c.dataTrabalhado} | Cortado: ${c.qtdReal} | Tecido: ${c.tecido} | Folhas: ${c.folhas}`,'primary'));
    dbCostura.filter(x=>x.corte.toString().toLowerCase()===num).forEach(o => {
        if (o.status==='Concluido') ri(`Oficina Retornada [Cor: ${o.cor}]`,`Nome: ${o.nome||'--'} | Retorno: ${o.dataRetorno} | Devolvida: ${o.devolvida} | Descarte: ${o.descarte} | Falta: ${o.faltaReal} | Tecido: ${o.tecido}`,'success');
        else ri(`Oficina Em Andamento [Cor: ${o.cor}]`,`Nome: ${o.nome||'--'} | Saiu: ${o.dataEnvio} | Enviada: ${o.enviada} | Tecido: ${o.tecido} | Folhas: ${o.folhas}`,'warning');
    });
    dbCosturado.filter(x=>x.corte.toString().toLowerCase()===num).forEach(c => {
        if (c.costuraId==='DiretoChefe') ri(`Injecao Chefe no Costurado [Cor: ${c.cor}]`,`Data: ${c.dataChegada} | Qtd: ${c.recOriginal} | Tecido: ${c.tecido} | Folhas: ${c.folhas}`,'danger');
        else ri(`Costurado [Cor: ${c.cor}]`,`Chegou: ${c.dataChegada} | Saldo atual: ${c.saldoAtual} | Tecido: ${c.tecido} | Folhas: ${c.folhas}`,'primary');
    });
    dbAcabamento.filter(x=>x.corte.toString().toLowerCase()===num).forEach(a => {
        if (a.status==='Finalizado') ri(`Acabamento Finalizado OS ${a.osGerada} [Cor: ${a.cor}]`,`Resp: ${a.resp} | Terminou: ${a.dataFim} | ${a.qtdSP} p/ Matrizes | ${a.qtdReserva} p/ Reserva | Tecido: ${a.tecido} | Folhas: ${a.folhas}`,'danger');
        else ri(`Acabamento Em Processo OS ${a.osGerada} [Cor: ${a.cor}]`,`Resp: ${a.resp} | Iniciou: ${a.dataInicio} | Tecido: ${a.tecido} | Folhas: ${a.folhas}`,'warning');
    });
    dbReservaSaidas.filter(x=>x.corte.toString().toLowerCase()===num).forEach(s => ri(`Despachado do Estoque Reserva [Cor: ${s.cor}]`,`Data: ${s.dataSaida} | Marca: ${s.marca} | Destino: ${s.destino} | Qtd: ${s.qtdSaida} | Tecido: ${s.tecido}`,'success'));
    if (tl.innerHTML==='') ri("Nenhum registro encontrado",`N° ${num} nao localizado em nenhum modulo.`,'danger');
}

// ==========================================
// RASTREABILIDADE NA OFICINA
// ==========================================
document.getElementById('ofi-rast-input')?.addEventListener('keypress', e => { if (e.key==='Enter') buscarRastOficina(); });
document.getElementById('ofi-rast-btn')?.addEventListener('click', buscarRastOficina);

function buscarRastOficina() {
    const val = document.getElementById('ofi-rast-input').value.trim().toLowerCase();
    if (!val) return;
    const tipo = document.querySelector('input[name="ofi-rast-tipo"]:checked')?.value || 'corte';
    const box = document.getElementById('ofi-rast-resultado');
    box.innerHTML = ''; box.style.display = 'block';
    const ri = (title, meta, type='default') => { box.innerHTML += `<div class="timeline-item ${type}"><h4>${title}</h4><p>${meta}</p></div>`; };

    if (tipo === 'ref') {
        // Busca por Referência (Modelo) — mostra todos os cortes que pertencem a essa referência
        const lotes = dbCostura.filter(x => x.ref.toString().toLowerCase().includes(val));
        if (lotes.length === 0) { ri("Nenhum registro encontrado", `Referência "${val}" não localizada na oficina.`, 'danger'); return; }
        // Agrupar por nº corte
        const byCorte = {};
        lotes.forEach(o => { if (!byCorte[o.corte]) byCorte[o.corte] = []; byCorte[o.corte].push(o); });
        Object.keys(byCorte).forEach(corte => {
            ri(`Corte N° ${corte} — Ref: ${byCorte[corte][0].ref}`, `${byCorte[corte].length} lote(s) na oficina`, 'primary');
            byCorte[corte].forEach(o => {
                if (o.status === 'Concluido')
                    ri(`  ✓ Retornado [${o.cor}] — ${o.nome||'--'}`, `Saiu: ${o.dataEnvio} | Retornou: ${o.dataRetorno} | Env: ${o.enviada} | Dev: ${o.devolvida} | Desc: ${o.descarte} | TCD: ${o.tecido} | → Acab: ${o.irAca||0} / Est.Cost: ${o.irEstc||0}`, 'success');
                else
                    ri(`  ⏳ Em Andamento [${o.cor}] — ${o.nome||'--'}`, `Saiu: ${o.dataEnvio} | Enviada: ${o.enviada} | TCD: ${o.tecido} | FL: ${o.folhas}`, 'warning');
            });
        });
    } else {
        // Busca por Nº Corte — mostra a referência e histórico completo
        const lotes = dbCostura.filter(x => x.corte.toString().toLowerCase() === val);
        if (lotes.length === 0) { ri("Nenhum registro encontrado", `N° ${val} não localizado na oficina.`, 'danger'); return; }
        ri(`Corte N° ${val} — Referência: ${lotes[0].ref}`, `Total de ${lotes.length} lote(s) na oficina para este corte`, 'primary');
        lotes.forEach(o => {
            if (o.status === 'Concluido')
                ri(`Retornado [Cor: ${o.cor}] — ${o.nome||'Sem nome'}`, `Saiu: ${o.dataEnvio} | Retornou: ${o.dataRetorno} | Enviada: ${o.enviada} | Devolvida: ${o.devolvida} | Descarte: ${o.descarte} | TCD: ${o.tecido} | FL: ${o.folhas} | → Acab: ${o.irAca||0} / Est.Cost: ${o.irEstc||0}`, 'success');
            else
                ri(`Em Andamento [Cor: ${o.cor}] — ${o.nome||'Sem nome'}`, `Saiu: ${o.dataEnvio} | Enviada: ${o.enviada} | TCD: ${o.tecido} | FL: ${o.folhas}`, 'warning');
        });
    }
}

// ==========================================
// RASTREABILIDADE NO COSTURADO
// ==========================================
document.getElementById('estc-rast-input')?.addEventListener('keypress', e => { if (e.key==='Enter') buscarRastCosturado(); });
document.getElementById('estc-rast-btn')?.addEventListener('click', buscarRastCosturado);

function buscarRastCosturado() {
    const num = document.getElementById('estc-rast-input').value.trim().toLowerCase();
    if (!num) return;
    const box = document.getElementById('estc-rast-resultado');
    box.innerHTML = ''; box.style.display = 'block';
    const ri = (title, meta, type='default') => { box.innerHTML += `<div class="timeline-item ${type}"><h4>${title}</h4><p>${meta}</p></div>`; };

    const lotes = dbCosturado.filter(x => x.corte.toString().toLowerCase() === num);
    if (lotes.length === 0) { ri("Nenhum registro encontrado", `N° ${num} não localizado no estoque costurado.`, 'danger'); return; }
    
    lotes.forEach(c => {
        const origem = c.costuraId === 'DiretoChefe' ? 'Injeção Direta (Chefe)' : 'Oficina (Retorno)';
        ri(`Costurado [Cor: ${c.cor}] — Origem: ${origem}`,
           `Chegou: ${c.dataChegada} | Recebido: ${c.recOriginal} pts | Saldo Atual: ${c.saldoAtual} pts | Tecido: ${c.tecido||'--'} | Folhas: ${c.folhas||'0'}`, 
           c.saldoAtual > 0 ? 'primary' : 'success');
    });

    // Mostrar saídas do costurado para acabamento
    const saidasAcab = dbAcabamento.filter(a => a.origem === 'Estoque Costurado' && a.corte.toString().toLowerCase() === num);
    saidasAcab.forEach(a => {
        ri(`Saiu p/ Acabamento [Cor: ${a.cor}] OS: ${a.osGerada||'--'}`,
           `Data: ${a.dataEmissao} | Qtd: ${a.qtdRecebida} | Status: ${a.status} | Resp: ${a.resp||'--'}`, 'warning');
    });
}

// ==========================================
// RELATÓRIOS
// ==========================================
function renderRelatorios() {
    // Sub-tab Pedidos
    const rPed = document.querySelector('#rel-tab-pedidos tbody');
    if (rPed) { rPed.innerHTML = ''; dbPedidos.forEach(x => { rPed.innerHTML += `<tr><td>${x.data_pedido}</td><td>${x.corte}</td><td>${x.ref}</td><td>${x.cor}</td><td>${x.tamanho}</td><td>${x.qtd_solicitada}</td><td>${x.tecido||'--'}</td><td>${x.cortado?'Cortado':'Pendente'}</td></tr>`; }); }
    // Corte
    const rCor = document.querySelector('#rel-tab-corte tbody');
    if (rCor) { rCor.innerHTML = ''; dbCorte.forEach(x => { rCor.innerHTML += `<tr><td>${x.dataTrabalhado}</td><td>${x.corte}</td><td>${x.ref}</td><td>${x.cor}</td><td>${x.tamanho}</td><td>${x.qtdReal}</td><td>${x.tecido||'--'}</td><td>${x.folhas||'0'}</td></tr>`; }); }
    // Oficina — com Nome
    const rOfi = document.querySelector('#rel-tab-oficina tbody');
    if (rOfi) { rOfi.innerHTML = ''; dbCostura.forEach(x => { rOfi.innerHTML += `<tr><td>${x.dataEnvio}</td><td>${x.dataRetorno||'--'}</td><td>${x.corte}</td><td>${x.cor}</td><td>${x.tamanho}</td><td>${x.tecido||'--'}</td><td>${x.folhas||'0'}</td><td>${x.nome||'--'}</td><td>${x.enviada}</td><td>${x.devolvida||0}</td><td>${x.descarte||0}</td><td>${x.faltaReal||0}</td><td>${x.status}</td></tr>`; }); }
    // Costurado
    const rEstc = document.querySelector('#rel-tab-costurado tbody');
    if (rEstc) { rEstc.innerHTML = ''; dbCosturado.forEach(x => { rEstc.innerHTML += `<tr><td>${x.dataChegada}</td><td>${x.corte}</td><td>${x.ref}</td><td>${x.cor}</td><td>${x.tamanho}</td><td>${x.tecido||'--'}</td><td>${x.folhas||'0'}</td><td>${x.recOriginal}</td><td>${x.saldoAtual}</td></tr>`; }); }
    // Acabamento
    const rAca = document.querySelector('#rel-tab-acabamento tbody');
    if (rAca) { rAca.innerHTML = ''; dbAcabamento.forEach(x => { rAca.innerHTML += `<tr><td>${x.dataInicio||'--'}</td><td>${x.dataFim||'--'}</td><td>${x.osGerada||'--'}</td><td>${x.corte}</td><td>${x.cor}</td><td>${x.tamanho}</td><td>${x.tecido||'--'}</td><td>${x.folhas||'0'}</td><td>${x.qtdRecebida}</td><td>${x.resp||'--'}</td><td>${x.status}</td></tr>`; }); }
    // Reserva
    const rRes = document.querySelector('#rel-tab-reserva tbody');
    if (rRes) { rRes.innerHTML = ''; dbReserva.forEach(x => { rRes.innerHTML += `<tr><td>${x.dataChegada}</td><td>${x.corte}</td><td>${x.ref}</td><td>${x.cor}</td><td>${x.tamanho}</td><td>${x.tecido||'--'}</td><td>${x.folhas||'0'}</td><td>${x.saldoAtual}</td></tr>`; }); }
    // Enviados
    const rEnv = document.querySelector('#rel-tab-enviados tbody');
    if (rEnv) {
        rEnv.innerHTML = '';
        dbAcabamento.filter(x=>x.status==='Finalizado'&&x.qtdSP>0).forEach(a => { rEnv.innerHTML += `<tr><td>${a.dataFim}</td><td>Acabamento</td><td>${a.corte}</td><td>Matrizes</td><td>--</td><td>${a.ref}/${a.cor}</td><td>${a.qtdSP}</td></tr>`; });
        dbReservaSaidas.forEach(s => { rEnv.innerHTML += `<tr><td>${s.dataSaida}</td><td>Est. Reserva</td><td>${s.corte}</td><td>${s.destino}</td><td>${s.marca}</td><td>${s.ref}/${s.cor}</td><td>${s.qtdSaida}</td></tr>`; });
    }
}

// ==========================================
// EXPORTAR EXCEL (ExcelJS — com bordas e resumos)
// ==========================================

// Helpers de estilo ExcelJS
const BORDER_THIN = {
    top:    { style: 'thin', color: { argb: 'FF000000' } },
    left:   { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right:  { style: 'thin', color: { argb: 'FF000000' } }
};
const HEADER_FONT  = { bold: true, size: 10 };
const NORMAL_FONT  = { size: 10 };
const HEADER_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
const SUMMARY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

function excelAddRow(ws, values, isHeader = false) {
    const row = ws.addRow(values);
    row.eachCell({ includeEmpty: true }, cell => {
        cell.border = BORDER_THIN;
        cell.font   = isHeader ? HEADER_FONT : NORMAL_FONT;
        if (isHeader) cell.fill = HEADER_FILL;
        cell.alignment = { vertical: 'middle', wrapText: false };
    });
    return row;
}

function excelAddSummaryTitle(ws, col, rowIdx, title) {
    const cell = ws.getCell(rowIdx, col);
    cell.value  = title;
    cell.font   = { bold: true, size: 10, underline: true };
    cell.border = BORDER_THIN;
    cell.fill   = SUMMARY_FILL;
    ws.getCell(rowIdx, col + 1).border = BORDER_THIN;
    ws.getCell(rowIdx, col + 1).fill   = SUMMARY_FILL;
    return rowIdx + 1;
}

function excelAddSummaryRow(ws, col, rowIdx, label, value) {
    const c1 = ws.getCell(rowIdx, col);
    const c2 = ws.getCell(rowIdx, col + 1);
    c1.value = label; c1.border = BORDER_THIN; c1.font = NORMAL_FONT;
    c2.value = value; c2.border = BORDER_THIN; c2.font = { bold: true, size: 10 };
    return rowIdx + 1;
}

window.exportarExcel = async () => {
    if (typeof ExcelJS === 'undefined') { alert('Biblioteca ExcelJS nao carregada. Verifique a conexao com a internet.'); return; }
    const ini = document.getElementById('exp-data-ini').value;
    const fim = document.getElementById('exp-data-fim').value;
    const inRange = (d) => (!ini || d >= ini) && (!fim || d <= fim);

    const wb = new ExcelJS.Workbook();
    wb.creator  = 'Sistema Max';
    wb.created  = new Date();
    let totalAbas = 0;

    // ---- Pedidos ----
    if (document.getElementById('exp-chk-pedidos').checked) {
        const ws = wb.addWorksheet('Pedidos');
        excelAddRow(ws, ['Data','N°Corte','Referência','Cor','Tamanho','QTD','Tecido','Status'], true);
        dbPedidos.filter(x => inRange(x.data_pedido)).forEach(x => {
            excelAddRow(ws, [x.data_pedido, x.corte, x.ref, x.cor, x.tamanho, x.qtd_solicitada, x.tecido||'--', x.cortado?'Cortado':'Pendente']);
        });
        ws.columns.forEach(c => { c.width = 16; });
        totalAbas++;
    }

    // ---- Corte ----
    if (document.getElementById('exp-chk-corte').checked) {
        const ws = wb.addWorksheet('Corte');
        const dados = dbCorte.filter(x => inRange(x.dataTrabalhado));
        excelAddRow(ws, ['Data','N°Corte','Referência','Cor','Tamanho','QTD','Tecido','Folha'], true);
        dados.forEach(x => excelAddRow(ws, [x.dataTrabalhado, x.corte, x.ref, x.cor, x.tamanho, x.qtdReal, x.tecido, x.folhas]));
        ws.columns.forEach(c => { c.width = 16; });

        // Resumo por Cor
        const RCOL = 7;
        let rRow = 1;
        rRow = excelAddSummaryTitle(ws, RCOL, rRow, 'RESUMO POR COR');
        ws.getCell(rRow - 1, RCOL + 1).value = 'Qtd Cortada';
        ws.getCell(rRow - 1, RCOL + 1).border = BORDER_THIN;
        ws.getCell(rRow - 1, RCOL + 1).font = HEADER_FONT;
        const porCor = {};
        dados.forEach(x => { porCor[x.cor] = (porCor[x.cor] || 0) + x.qtdReal; });
        Object.entries(porCor).sort().forEach(([cor, qtd]) => { rRow = excelAddSummaryRow(ws, RCOL, rRow, cor, qtd); });
        rRow++;

        // Resumo por Tamanho
        rRow = excelAddSummaryTitle(ws, RCOL, rRow, 'RESUMO POR TAMANHO');
        ws.getCell(rRow - 1, RCOL + 1).value = 'Qtd Cortada';
        ws.getCell(rRow - 1, RCOL + 1).border = BORDER_THIN;
        ws.getCell(rRow - 1, RCOL + 1).font = HEADER_FONT;
        const porTam = {};
        dados.forEach(x => { porTam[x.tamanho] = (porTam[x.tamanho] || 0) + x.qtdReal; });
        Object.entries(porTam).sort().forEach(([tam, qtd]) => { rRow = excelAddSummaryRow(ws, RCOL, rRow, tam, qtd); });
        rRow++;

        // Subtotal
        const totalCortado = dados.reduce((a, x) => a + x.qtdReal, 0);
        excelAddSummaryRow(ws, RCOL, rRow, 'SUBTOTAL GERAL', totalCortado);
        ws.getColumn(RCOL).width = 20;
        ws.getColumn(RCOL + 1).width = 14;
        totalAbas++;
    }

    // ---- Oficina ----
    if (document.getElementById('exp-chk-oficina').checked) {
        const ws = wb.addWorksheet('Oficina');
        const dados = dbCostura.filter(x => inRange(x.dataEnvio));
        excelAddRow(ws, ['Data','Data','N°Corte','Cor','Tamanho','Tecido','Folha','Nome','QTD','QTD','Descarte','Falta','Status'], true);
        dados.forEach(x => excelAddRow(ws, [x.dataEnvio, x.dataRetorno||'--', x.corte, x.cor, x.tamanho, x.tecido, x.folhas, x.nome||'--', x.enviada, x.devolvida||0, x.descarte||0, x.faltaReal||0, x.status]));
        ws.columns.forEach(c => { c.width = 15; });

        // Resumo Oficina
        const RCOL = 12;
        let rRow = 1;
        rRow = excelAddSummaryTitle(ws, RCOL, rRow, 'RESUMO GERAL');
        ws.getCell(rRow - 1, RCOL + 1).border = BORDER_THIN; ws.getCell(rRow - 1, RCOL + 1).font = HEADER_FONT;
        const totalEnv  = dados.reduce((a, x) => a + (x.enviada || 0), 0);
        const totalVolt = dados.reduce((a, x) => a + (x.devolvida || 0), 0);
        const totalDesc = dados.reduce((a, x) => a + (x.descarte || 0), 0);
        const totalFlt  = dados.reduce((a, x) => a + (x.faltaReal || 0), 0);
        rRow = excelAddSummaryRow(ws, RCOL, rRow, 'Total Enviadas', totalEnv);
        rRow = excelAddSummaryRow(ws, RCOL, rRow, 'Total Voltaram', totalVolt);
        rRow = excelAddSummaryRow(ws, RCOL, rRow, 'Total Descartes', totalDesc);
        rRow = excelAddSummaryRow(ws, RCOL, rRow, 'Total Faltantes', totalFlt);
        rRow++;

        // Por status
        rRow = excelAddSummaryTitle(ws, RCOL, rRow, 'POR STATUS');
        ws.getCell(rRow - 1, RCOL + 1).border = BORDER_THIN; ws.getCell(rRow - 1, RCOL + 1).font = HEADER_FONT;
        const porStatus = {};
        dados.forEach(x => { porStatus[x.status] = (porStatus[x.status] || 0) + 1; });
        Object.entries(porStatus).forEach(([s, c]) => { rRow = excelAddSummaryRow(ws, RCOL, rRow, s, c + ' lotes'); });
        ws.getColumn(RCOL).width = 20;
        ws.getColumn(RCOL + 1).width = 14;
        totalAbas++;
    }

    // ---- Estoque Costurado ----
    if (document.getElementById('exp-chk-costurado').checked) {
        const ws = wb.addWorksheet('Est Costurado');
        const dados = dbCosturado.filter(x => inRange(x.dataChegada));
        excelAddRow(ws, ['Data','N°Corte','Referência','Cor','Tamanho','Tecido','Folha','QTD','QTD'], true);
        dados.forEach(x => excelAddRow(ws, [x.dataChegada, x.corte, x.ref, x.cor, x.tamanho, x.tecido, x.folhas, x.recOriginal, x.saldoAtual]));
        ws.columns.forEach(c => { c.width = 16; });

        // Resumo Costurado
        const RCOL = 8;
        let rRow = 1;
        rRow = excelAddSummaryTitle(ws, RCOL, rRow, 'PEÇAS GUARDADAS POR COR');
        ws.getCell(rRow - 1, RCOL + 1).value = 'Saldo Atual'; ws.getCell(rRow - 1, RCOL + 1).border = BORDER_THIN; ws.getCell(rRow - 1, RCOL + 1).font = HEADER_FONT;
        const pCor = {};
        dados.forEach(x => { pCor[x.cor] = (pCor[x.cor] || 0) + x.saldoAtual; });
        Object.entries(pCor).sort().forEach(([k, v]) => { rRow = excelAddSummaryRow(ws, RCOL, rRow, k, v); });
        rRow++;

        rRow = excelAddSummaryTitle(ws, RCOL, rRow, 'PEÇAS GUARDADAS POR TAMANHO');
        ws.getCell(rRow - 1, RCOL + 1).value = 'Saldo Atual'; ws.getCell(rRow - 1, RCOL + 1).border = BORDER_THIN; ws.getCell(rRow - 1, RCOL + 1).font = HEADER_FONT;
        const pTam = {};
        dados.forEach(x => { pTam[x.tamanho] = (pTam[x.tamanho] || 0) + x.saldoAtual; });
        Object.entries(pTam).sort().forEach(([k, v]) => { rRow = excelAddSummaryRow(ws, RCOL, rRow, k, v); });
        rRow++;

        const totalGuardado = dados.reduce((a, x) => a + x.saldoAtual, 0);
        excelAddSummaryRow(ws, RCOL, rRow, 'TOTAL GUARDADO', totalGuardado);
        ws.getColumn(RCOL).width = 24;
        ws.getColumn(RCOL + 1).width = 14;
        totalAbas++;
    }

    // ---- Acabamento ----
    if (document.getElementById('exp-chk-acabamento').checked) {
        const ws = wb.addWorksheet('Acabamento');
        const dados = dbAcabamento.filter(x => inRange(x.dataEmissao || x.dataInicio || ''));
        excelAddRow(ws, ['Data','Data','OS','N°Corte','Cor','Tamanho','Tecido','Folha','QTD','Nome','Status'], true);
        dados.forEach(x => excelAddRow(ws, [x.dataInicio||'--', x.dataFim||'--', x.osGerada||'--', x.corte, x.cor, x.tamanho, x.tecido, x.folhas, x.qtdRecebida, x.resp||'--', x.status]));
        ws.columns.forEach(c => { c.width = 14; });

        // Resumo por Responsável
        const RCOL = 12;
        let rRow = 1;
        rRow = excelAddSummaryTitle(ws, RCOL, rRow, 'RESUMO POR RESPONSÁVEL');
        ws.getCell(rRow - 1, RCOL + 1).value = 'Total OS'; ws.getCell(rRow - 1, RCOL + 1).border = BORDER_THIN; ws.getCell(rRow - 1, RCOL + 1).font = HEADER_FONT;
        const porResp = {};
        dados.forEach(x => { if (x.resp) porResp[x.resp] = (porResp[x.resp] || 0) + 1; });
        Object.entries(porResp).sort().forEach(([k, v]) => { rRow = excelAddSummaryRow(ws, RCOL, rRow, k, v + ' OS'); });
        rRow++;

        // Por Status
        rRow = excelAddSummaryTitle(ws, RCOL, rRow, 'POR STATUS');
        ws.getCell(rRow - 1, RCOL + 1).border = BORDER_THIN; ws.getCell(rRow - 1, RCOL + 1).font = HEADER_FONT;
        const porSt = {};
        dados.forEach(x => { porSt[x.status] = (porSt[x.status] || 0) + 1; });
        Object.entries(porSt).forEach(([k, v]) => { rRow = excelAddSummaryRow(ws, RCOL, rRow, k, v + ' itens'); });
        rRow++;

        // Peças totais
        const totalAcab = dados.reduce((a, x) => a + (x.qtdRecebida || 0), 0);
        const totalSP   = dados.reduce((a, x) => a + (x.qtdSP || 0), 0);
        const totalRes  = dados.reduce((a, x) => a + (x.qtdReserva || 0), 0);
        rRow = excelAddSummaryTitle(ws, RCOL, rRow, 'TOTAIS DE PEÇAS');
        ws.getCell(rRow - 1, RCOL + 1).border = BORDER_THIN; ws.getCell(rRow - 1, RCOL + 1).font = HEADER_FONT;
        rRow = excelAddSummaryRow(ws, RCOL, rRow, 'Total Peças Acabadas', totalAcab);
        rRow = excelAddSummaryRow(ws, RCOL, rRow, 'Foram p/ Matrizes', totalSP);
        excelAddSummaryRow(ws, RCOL, rRow, 'Foram p/ Reserva', totalRes);
        ws.getColumn(RCOL).width = 24;
        ws.getColumn(RCOL + 1).width = 14;
        totalAbas++;
    }

    // ---- Estoque Reserva ----
    if (document.getElementById('exp-chk-reserva').checked) {
        const ws = wb.addWorksheet('Est Reserva');
        excelAddRow(ws, ['Data','N°Corte','Referência','Cor','Tamanho','Tecido','Folha','QTD'], true);
        dbReserva.filter(x => inRange(x.dataChegada)).forEach(x => excelAddRow(ws, [x.dataChegada, x.corte, x.ref, x.cor, x.tamanho, x.tecido, x.folhas, x.saldoAtual]));
        ws.columns.forEach(c => { c.width = 16; });
        totalAbas++;
    }

    // ---- Enviados ----
    if (document.getElementById('exp-chk-enviados').checked) {
        const ws = wb.addWorksheet('Enviados');
        excelAddRow(ws, ['Data','Fonte','N°Corte','Direção','Marca','Referência / Cor','Tecido','QTD'], true);
        dbAcabamento.filter(x => x.status==='Finalizado' && x.qtdSP>0 && inRange(x.dataFim))
            .forEach(a => excelAddRow(ws, [a.dataFim, 'Acabamento', a.corte, 'Matrizes', '--', `${a.ref}/${a.cor}`, a.tecido, a.qtdSP]));
        dbReservaSaidas.filter(x => inRange(x.dataSaida))
            .forEach(s => excelAddRow(ws, [s.dataSaida, 'Est. Reserva', s.corte, s.destino, s.marca, `${s.ref}/${s.cor}`, s.tecido, s.qtdSaida]));
        ws.columns.forEach(c => { c.width = 16; });
        totalAbas++;
    }

    // ---- Síntese Diária ----
    if (document.getElementById('exp-chk-sintese') && document.getElementById('exp-chk-sintese').checked) {
        const ws = wb.addWorksheet('Síntese Diária');
        let dailyEvents = {}; 
        
        const ensure = (d, r) => {
            if (!dailyEvents[d]) dailyEvents[d] = {};
            if (!dailyEvents[d][r]) dailyEvents[d][r] = { cortadas:0, envOficina:0, retOficina:0, iniAcabamento:0, finAcabamento:0, sp:0, reserva:0 };
        };

        dbCorte.filter(x => inRange(x.dataTrabalhado)).forEach(x => {
            if (!x.dataTrabalhado) return;
            ensure(x.dataTrabalhado, x.ref);
            dailyEvents[x.dataTrabalhado][x.ref].cortadas += (x.qtdReal || 0);
        });

        dbCostura.filter(x => inRange(x.dataEnvio)).forEach(x => {
            if (!x.dataEnvio) return;
            ensure(x.dataEnvio, x.ref);
            dailyEvents[x.dataEnvio][x.ref].envOficina += (x.enviada || 0);
        });
        dbCostura.filter(x => inRange(x.dataRetorno)).forEach(x => {
            if (!x.dataRetorno) return;
            ensure(x.dataRetorno, x.ref);
            dailyEvents[x.dataRetorno][x.ref].retOficina += (x.devolvida || 0);
        });

        dbAcabamento.filter(x => inRange(x.dataInicio)).forEach(x => {
            if (!x.dataInicio) return;
            ensure(x.dataInicio, x.ref);
            dailyEvents[x.dataInicio][x.ref].iniAcabamento += (x.qtdRecebida || 0);
        });
        dbAcabamento.filter(x => x.status === 'Finalizado' && inRange(x.dataFim)).forEach(x => {
            if (!x.dataFim) return;
            ensure(x.dataFim, x.ref);
            dailyEvents[x.dataFim][x.ref].finAcabamento += ((x.qtdSP || 0) + (x.qtdReserva || 0));
            dailyEvents[x.dataFim][x.ref].sp += (x.qtdSP || 0);
            dailyEvents[x.dataFim][x.ref].reserva += (x.qtdReserva || 0);
        });
        
        excelAddRow(ws, ['Data', 'Referência', 'Qtd Cortada', 'Env. Oficina', 'Ret. Oficina', 'Entrou Acab.', 'Finalizou Acab.', 'Foi p/ Vendas', 'Foi p/ Reserva'], true);
        
        let sortedDates = Object.keys(dailyEvents).sort();
        sortedDates.forEach(d => {
            let refs = Object.keys(dailyEvents[d]).sort();
            refs.forEach(r => {
                const v = dailyEvents[d][r];
                if (v.cortadas===0 && v.envOficina===0 && v.retOficina===0 && v.iniAcabamento===0 && v.finAcabamento===0) return;
                excelAddRow(ws, [d, r, v.cortadas, v.envOficina, v.retOficina, v.iniAcabamento, v.finAcabamento, v.sp, v.reserva]);
            });
            const tCortadas = refs.reduce((a, r) => a + dailyEvents[d][r].cortadas, 0);
            const tEnvOf = refs.reduce((a, r) => a + dailyEvents[d][r].envOficina, 0);
            const tRetOf = refs.reduce((a, r) => a + dailyEvents[d][r].retOficina, 0);
            const tIniAc = refs.reduce((a, r) => a + dailyEvents[d][r].iniAcabamento, 0);
            const tFinAc = refs.reduce((a, r) => a + dailyEvents[d][r].finAcabamento, 0);
            const tSp = refs.reduce((a, r) => a + dailyEvents[d][r].sp, 0);
            const tRes = refs.reduce((a, r) => a + dailyEvents[d][r].reserva, 0);
            
            if (tCortadas>0 || tEnvOf>0 || tRetOf>0 || tIniAc>0 || tFinAc>0) {
                const subRow = excelAddRow(ws, [d + ' (TOTAL)', 'SOMA DO DIA', tCortadas, tEnvOf, tRetOf, tIniAc, tFinAc, tSp, tRes]);
                subRow.eachCell(c => { c.font = {bold: true}; c.fill = SUMMARY_FILL; });
                ws.addRow([]);
            }
        });
        
        ws.columns.forEach(c => { c.width = 16; });
        totalAbas++;
    }

    if (totalAbas === 0) { alert('Selecione ao menos uma aba para exportar.'); return; }

    // Gerar e baixar arquivo
    const buffer   = await wb.xlsx.writeBuffer();
    const blob     = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const nomeArq  = `Relatorio_Max_${ini||'inicio'}_${fim||'fim'}.xlsx`;
    a.href = url; a.download = nomeArq; a.click();
    URL.revokeObjectURL(url);
};

renderAll();

window.migrarParaNuvem = async () => {
    if(!confirm('Atenção: Isso vai enviar TODO o seu banco local atual para a nuvem. Tem certeza?')) return;
    console.log('Iniciando migração...');
    const keys = ['dbPedidos','dbCorte','dbCostura','dbCosturado','dbAcabamento','dbReserva','dbReservaSaidas', 'dbOsCounters'];
    for (const key of keys) {
        const val = JSON.parse(localStorage.getItem(key));
        if (val && val.length > 0) syncToSupabase(key, val);
        if (key === 'dbOsCounters' && val) syncToSupabase(key, val);
    }
    alert('Migração disparada no fundo! Verifique os logs no Console (F12). A página será recarregada daqui a 5 segundos para limpar o cache.');
    setTimeout(() => window.location.reload(), 5000);
};
