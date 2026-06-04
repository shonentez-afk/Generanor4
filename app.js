function calculateFrequencies(bearingName, rpm) {
    console.log('🔍 Ищем подшипник:', bearingName);
    console.log('📦 База подшипников:', Object.keys(BEARINGS_DB));
    
    const b = BEARINGS_DB[bearingName];
    
    if (!b) {
        const errorMsg = `Подшипник "${bearingName}" не найден!\nДоступные: ${Object.keys(BEARINGS_DB).join(', ')}`;
        console.error('❌', errorMsg);
        alert(errorMsg);
        return null;
    }
    
    const fr = rpm / 60.0;
    const d_D = b.d / b.D;
    const cos_a = Math.cos(b.alpha * Math.PI / 180);
    
    return {
        fr: fr,
        BPFO: (b.n / 2) * fr * (1 - d_D * cos_a),
        BPFI: (b.n / 2) * fr * (1 + d_D * cos_a),
        BSF: (b.D / (2 * b.d)) * fr * (1 - Math.pow(d_D * cos_a, 2)),
        FTF: (fr / 2) * (1 - d_D * cos_a),
        '2xBSF': 2 * (b.D / (2 * b.d)) * fr * (1 - Math.pow(d_D * cos_a, 2))
    };
}

function generateSpectrum() {
    try {
        const bearingSelect = document.getElementById('bearing');
        const bearing = bearingSelect ? bearingSelect.value : null;
        const rpmInput = document.getElementById('rpm');
        const rpm = rpmInput ? parseFloat(rpmInput.value) : 1500;
        const defectSelect = document.getElementById('defect');
        const defect = defectSelect ? defectSelect.value : 'BPFO';
        const stageInput = document.getElementById('stage');
        const stage = stageInput ? parseInt(stageInput.value) : 2;
        
        console.log('📊 Параметры:', { bearing, rpm, defect, stage });
        
        if (!bearing) {
            alert('Ошибка: не выбран подшипник!');
            return;
        }
        
        const freqs = calculateFrequencies(bearing, rpm);
        if (!freqs) {
            return; // Ошибка уже показана в calculateFrequencies
        }
        
        // Остальной код без изменений...
        document.getElementById('info').innerHTML = `
            <strong>📊 Расчетные частоты для ${bearing}:</strong><br>
            BPFO (наружное кольцо): ${freqs.BPFO.toFixed(2)} Гц<br>
            BPFI (внутреннее кольцо): ${freqs.BPFI.toFixed(2)} Гц<br>
            BSF (тело качения): ${freqs.BSF.toFixed(2)} Гц<br>
            FTF (сепаратор): ${freqs.FTF.toFixed(2)} Гц<br>
            2×BSF (дефект тела): ${freqs['2xBSF'].toFixed(2)} Гц<br>
            <strong>Обороты вала:</strong> ${freqs.fr.toFixed(2)} Гц (${rpm} об/мин)<br>
            <strong>Тип дефекта:</strong> ${defect}, Стадия: ${stage}
        `;
        
        // Генерация графика...
        const xValues = [];
        const yValues = [];
        
        for (let i = 0; i <= 500; i += 10) {
            xValues.push(i);
            let amplitude = 0.1 + Math.random() * 0.1;
            
            const defectFreq = freqs[defect] || freqs.BPFO;
            for (let h = 1; h <= stage; h++) {
                const harmonicFreq = defectFreq * h;
                const distance = Math.abs(i - harmonicFreq);
                if (distance < 20) {
                    amplitude += (1 - distance/20) * (stage * 0.3);
                }
            }
            
            yValues.push(amplitude);
        }
        
        const trace = {
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#0077FF', width: 2 }
        };
        
        const layout = {
            title: `Спектр огибающей: ${bearing}, ${defect}, стадия ${stage}`,
            xaxis: { title: 'Частота, Гц', range: [0, 500] },
            yaxis: { title: 'Амплитуда, g' },
            margin: { t: 50, b: 50, l: 50, r: 20 }
        };
        
        Plotly.newPlot('plot', [trace], layout);
        console.log('✅ Спектр построен успешно');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}
