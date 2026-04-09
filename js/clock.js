document.addEventListener("DOMContentLoaded", function () {
    const container = document.getElementById("my-clock-widget");
    if (!container) return;

    container.innerHTML = `
        <div style="text-align:center;margin-top:10px;">
            <div id="date" style="font-size:14px;margin-bottom:8px;"></div>
            <div id="clock" style="display:flex;justify-content:center;gap:6px;"></div>
        </div>
    `;

    const map = {
        0: ['a','b','c','d','e','f'],
        1: ['b','c'],
        2: ['a','b','g','e','d'],
        3: ['a','b','g','c','d'],
        4: ['f','g','b','c'],
        5: ['a','f','g','c','d'],
        6: ['a','f','g','e','c','d'],
        7: ['a','b','c'],
        8: ['a','b','c','d','e','f','g'],
        9: ['a','b','c','d','f','g']
    };

    function createDigit() {
        const d = document.createElement('div');
        d.style.position = 'relative';
        d.style.width = '30px';
        d.style.height = '50px';

        ['a','b','c','d','e','f','g'].forEach(s => {
            const seg = document.createElement('div');
            seg.className = `seg-${s}`;
            seg.style.position = 'absolute';
            seg.style.background = '#ddd';
            seg.style.borderRadius = '2px';

            const styleMap = {
                a: 'top:0;left:5px;width:20px;height:4px;',
                b: 'top:4px;right:0;width:4px;height:20px;',
                c: 'bottom:4px;right:0;width:4px;height:20px;',
                d: 'bottom:0;left:5px;width:20px;height:4px;',
                e: 'bottom:4px;left:0;width:4px;height:20px;',
                f: 'top:4px;left:0;width:4px;height:20px;',
                g: 'top:23px;left:5px;width:20px;height:4px;'
            };

            seg.style.cssText += styleMap[s];
            d.appendChild(seg);
        });

        return d;
    }

    const clock = container.querySelector("#clock");
    let digits = [];

    function init() {
        for (let i = 0; i < 6; i++) {
            const d = createDigit();
            digits.push(d);
            clock.appendChild(d);

            if (i === 1 || i === 3) {
                const colon = document.createElement('div');
                colon.innerHTML = `<div style="width:4px;height:4px;background:#666;margin:3px auto;"></div>
                                   <div style="width:4px;height:4px;background:#666;margin:3px auto;"></div>`;
                clock.appendChild(colon);
            }
        }
    }

    function render(num, digit) {
        digit.querySelectorAll('div').forEach(s => s.style.background = '#ddd');
        map[num].forEach(k => {
            digit.querySelector(`.seg-${k}`).style.background = '#111';
        });
    }

    function update() {
        const now = new Date();

        const str =
            String(now.getHours()).padStart(2,'0') +
            String(now.getMinutes()).padStart(2,'0') +
            String(now.getSeconds()).padStart(2,'0');

        digits.forEach((d, i) => render(Number(str[i]), d));

        const weekMap = ['周日','周一','周二','周三','周四','周五','周六'];

        const dateStr =
            now.getFullYear() + '-' +
            String(now.getMonth()+1).padStart(2,'0') + '-' +
            String(now.getDate()).padStart(2,'0') +
            ' ' + weekMap[now.getDay()];

        container.querySelector("#date").innerText = dateStr;
    }

    init();
    setInterval(update, 1000);
    update();
});