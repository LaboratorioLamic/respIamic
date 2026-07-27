// Indicadores e gráficos

// INDICADORES & FILTROS
function toggleIndFilters() {
    const type = document.getElementById('ind-filter-type').value;
    document.getElementById('ind-box-year').classList.toggle('hidden', type !== 'year');
    document.getElementById('ind-box-month').classList.toggle('hidden', type !== 'month');
    document.getElementById('ind-box-start').classList.toggle('hidden', type !== 'range');
    document.getElementById('ind-box-end').classList.toggle('hidden', type !== 'range');
}

function filterIndData() {
    const type = document.getElementById('ind-filter-type').value;
    return appointments.filter(app => {
        if (type === 'all') return true;
        if (type === 'year') return app.data.startsWith(document.getElementById('ind-year').value);
        if (type === 'month') return app.data.startsWith(document.getElementById('ind-month').value);
        if (type === 'range') {
            const s = document.getElementById('ind-start').value;
            const e = document.getElementById('ind-end').value;
            return (s ? app.data >= s : true) && (e ? app.data <= e : true);
        }
        return true;
    });
}

function renderIndicadores() {
    const indData = filterIndData();

    const tresp = indData.filter(a => a.exame === 'TRESP');
    const tsbac = indData.filter(a => a.exame === 'TSBAC');
    const concluidos = indData.filter(a => a.status === 'Concluído');
    const andamento = indData.filter(a => a.status === 'Em andamento');
    const pendentes = indData.filter(a => a.status === 'Agendado');
    const cancelados = indData.filter(a => a.status === 'Cancelado');
    
    document.getElementById('kpi-total').innerText = indData.length;
    document.getElementById('kpi-tresp').innerText = tresp.length;
    document.getElementById('kpi-tsbac').innerText = tsbac.length;
    document.getElementById('kpi-concluidos').innerText = concluidos.length;
    document.getElementById('kpi-andamento').innerText = andamento.length;
    document.getElementById('kpi-pendentes').innerText = pendentes.length;
    document.getElementById('kpi-cancelados').innerText = cancelados.length;

    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    // Gráfico de Barras Mensal
    const monthlyData = new Array(12).fill(0);
    indData.forEach(a => monthlyData[new Date(a.data + 'T12:00:00').getMonth()]++);

    if(charts.bar) charts.bar.destroy();
    charts.bar = new Chart(document.getElementById('chart-bar-monthly'), {
        type: 'bar',
        data: { labels: months, datasets: [{ label: 'Volume Total', data: monthlyData, backgroundColor: '#1e40af' }] }
    });

    // Gráfico de Linha - Volume de Exames por Tipo
    const trespData = new Array(12).fill(0);
    const tsbacData = new Array(12).fill(0);
    
    // Contar exames por mês
    indData.forEach(a => {
        const month = new Date(a.data + 'T12:00:00').getMonth();
        if (a.exame === 'TRESP') trespData[month]++;
        if (a.exame === 'TSBAC') tsbacData[month]++;
    });

    if(charts.line) charts.line.destroy();
    charts.line = new Chart(document.getElementById('chart-line-trend'), {
        type: 'line',
        data: { 
            labels: months, 
            datasets: [
                { label: 'TRESP', data: trespData, borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.3 },
                { label: 'TSBAC', data: tsbacData, borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.3 }
            ] 
        }
    });

    // Gráfico Donut - Exames
    if(charts.donutE) charts.donutE.destroy();
    charts.donutE = new Chart(document.getElementById('chart-donut-exame'), {
        type: 'doughnut',
        data: { labels: ['TRESP', 'TSBAC'], datasets: [{ data: [tresp.length, tsbac.length], backgroundColor: ['#3b82f6', '#10b981'] }] }
    });

    // Gráfico Donut - Substratos
    if(charts.donutS) charts.donutS.destroy();
    const subMap = {};
    indData.forEach(a => subMap[a.substrato] = (subMap[a.substrato] || 0) + 1);
    charts.donutS = new Chart(document.getElementById('chart-donut-substrato'), {
        type: 'doughnut',
        data: { labels: Object.keys(subMap), datasets: [{ data: Object.values(subMap), backgroundColor: ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'] }] }
    });
}
