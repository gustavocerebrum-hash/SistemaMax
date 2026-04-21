import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

sync_logic = """
// ==========================================
// SUPABASE SYNC LOGIC
// ==========================================
async function fetchAllSupabase() {
    console.log('Buscando dados da nuvem...');
    const tables = ['pedidos', 'corte', 'costura', 'costurado', 'acabamento', 'reserva', 'reserva_saidas'];
    const setters = [
        v => dbPedidos = v, v => dbCorte = v, v => dbCostura = v, v => dbCosturado = v, 
        v => dbAcabamento = v, v => dbReserva = v, v => dbReservaSaidas = v
    ];

    for(let i=0; i<tables.length; i++) {
        const { data, error } = await supabase.from(tables[i]).select('*');
        if(data && !error && data.length > 0) setters[i](data);
    }
    
    const { data: oc } = await supabase.from('os_counters').select('*');
    if(oc && oc.length > 0) {
        dbOsCounters = {};
        oc.forEach(o => dbOsCounters[o.resp] = o.counter);
    }
    
    renderAll();
    console.log('Dados da nuvem carregados!');
}

function syncToSupabase(key, data) {
    localStorage.setItem(key, JSON.stringify(data)); // Mantém backup local
    const tableMap = {
        'dbPedidos': 'pedidos',
        'dbCorte': 'corte',
        'dbCostura': 'costura',
        'dbCosturado': 'costurado',
        'dbAcabamento': 'acabamento',
        'dbReserva': 'reserva',
        'dbReservaSaidas': 'reserva_saidas'
    };
    const remota = tableMap[key];
    if(remota && data && data.length > 0) {
        supabase.from(remota).upsert(data).then(({error}) => {
            if(error) console.error("Erro no upsert da tabela", remota, error);
        });
    }
    if (key === 'dbOsCounters') {
        const arr = Object.keys(data).map(resp => ({ resp, counter: data[resp] }));
        if(arr.length > 0) supabase.from('os_counters').upsert(arr).then();
    }
}

function syncDeleteCascade(corte, cor, tam, startIdx) {
    const tabelas = ['pedidos', 'corte', 'costura', 'costurado', 'acabamento', 'reserva'];
    for (let i = startIdx; i < tabelas.length; i++) {
        supabase.from(tabelas[i]).delete().eq('corte', corte).eq('cor', cor).eq('tamanho', tam).then();
    }
    if (startIdx <= 5) {
        supabase.from('reserva_saidas').delete().eq('corte', corte).eq('cor', cor).eq('tamanho', tam).then();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    fetchAllSupabase();
});
"""

content = content.replace(
    'const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);', 
    'const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);\n' + sync_logic
)

content = re.sub(
    r"localStorage\.setItem\('([^']+)',\s*JSON\.stringify\(([^)]+)\)\)", 
    r"syncToSupabase('\1', \2)", 
    content
)

delete_logic = """
    // Sincroniza exclusão no Supabase
    syncDeleteCascade(corte, cor, tam, startIdx);
    
    ['dbPedidos','dbCorte','dbCostura','dbCosturado','dbAcabamento','dbReserva','dbReservaSaidas'].forEach(k =>
"""
content = content.replace(
    "['dbPedidos','dbCorte','dbCostura','dbCosturado','dbAcabamento','dbReserva','dbReservaSaidas'].forEach(k =>", 
    delete_logic
)

migration_logic = """
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
"""

content = content + migration_logic

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Refatoração concluída com sucesso!")
