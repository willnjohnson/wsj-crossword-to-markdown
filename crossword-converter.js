// ==UserScript==
// @name         WSJ Crossword to Markdown
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Export crossword clues (and answers) as markdown
// @match        *://www.wsj.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ---------- BUTTON ----------
    function createButton() {
        if (document.getElementById('puzzle-export-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'puzzle-export-btn';
        btn.textContent = 'Export Clues';

        Object.assign(btn.style, {
            position: 'fixed',
            top: '0px',
            right: '0px',
            zIndex: '999999',
            display: 'flex',
            height: '45px',
            backgroundColor: '#0274b6',
            color: '#fff',
            padding: '0 20px',
            marginBottom: '15px',
            border: 'none',
            borderRadius: '2px',
            fontSize: '14px',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 125ms ease'
        });
      
        btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = '#025a8c';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = '#0274b6';
        });

        btn.onclick = exportClues;
        document.body.appendChild(btn);
    }

    // ---------- PARSER ----------
    function parseSection(section) {
        const clues = [];
        const items = section.querySelectorAll('li');

        items.forEach(item => {
            const number = item.querySelector('.clue__number')?.textContent.trim();
            const text = item.querySelector('.clue__text')?.textContent.trim();

            if (!number || !text) return;

            // Find all boxes for this clue
            const boxes = item.querySelectorAll('.clue-boxes__box');
            
            // Map through boxes to get the letters you've typed
            let answer = '';
            boxes.forEach(box => {
                // WSJ usually puts the letter in a child element or the box itself
                // We trim it and use a dot/underscore if it's empty
                const letter = box.textContent.trim();
                answer += letter !== '' ? letter : '_';
            });

            clues.push({
                number,
                text,
                answer: answer || '_'.repeat(boxes.length)
            });
        });

        return clues;
    }

    function parseClues() {
        const acrossEl = document.querySelector('.clue-set--across');
        const downEl = document.querySelector('.clue-set--down');

        if (!acrossEl && !downEl) return null;

        return {
            across: acrossEl ? parseSection(acrossEl) : [],
            down: downEl ? parseSection(downEl) : []
        };
    }

    // ---------- EXPORT ----------
    function toMarkdown(data) {
        let md = '# Crossword Clues\n\n';

        md += '## ACROSS\n\n| # | Clue | Answer |\n|---|------|--------|\n';
        data.across.forEach(c => {
            md += `| ${c.number} | ${c.text} | ${c.answer} |\n`;
        });

        md += '\n## DOWN\n\n| # | Clue | Answer |\n|---|------|--------|\n';
        data.down.forEach(c => {
            md += `| ${c.number} | ${c.text} | ${c.answer} |\n`;
        });

        return md;
    }

    function exportClues() {
        const clues = parseClues();

        if (!clues) {
            alert('No clues found on this page.');
            return;
        }

        const md = toMarkdown(clues);

        navigator.clipboard.writeText(md)
            .then(() => alert('Clues copied to clipboard!'))
            .catch(() => {
                console.log(md);
                alert('Copy failed — see console.');
            });
    }

    // ---------- INIT ----------
    function init() {
        const interval = setInterval(() => {
            // Only inject if clues exist
            if (document.querySelector('.clue-set--across, .clue-set--down')) {
                createButton();
                clearInterval(interval);
            }
        }, 1000);

        // safety timeout
        setTimeout(() => clearInterval(interval), 15000);
    }

    init();

})();
