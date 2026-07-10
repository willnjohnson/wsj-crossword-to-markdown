// ==UserScript==
// @name         WSJ Crossword to Markdown
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Export crossword clues (and answers) as markdown
// @match        *://www.wsj.com/games/crosswords/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // WSJ's crossword page renders parts of the puzzle inside shadow roots,
    // so plain document.querySelectorAll may miss them. Walk into any
    // open shadow root it finds.
    function deepQueryAll(selector, root = document) {
        let results = Array.from(root.querySelectorAll(selector));
        root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
                results = results.concat(deepQueryAll(selector, el.shadowRoot));
            }
        });
        return results;
    }
  
    // Button
    function createButton() {
        if (document.getElementById('puzzle-export-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'puzzle-export-btn';
        btn.textContent = 'Export Clues';

        Object.assign(btn.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: '999999',
            display: 'flex',
            height: '45px',
            backgroundColor: '#0274b6',
            color: '#fff',
            padding: '0 20px',
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

    // Each clue panel is an <aside> whose <h3>Across</h3> / <h3>Down</h3>
    // header is immediately followed by a grid <div> of <button> clues.
    // Every button has two direct child <span>s: the clue number, then the
    // clue text. There are no letter boxes in this layout, so answer
    // lengths aren't available to the script anymore.
    function getClueButtons(label) {
        const header = deepQueryAll('h3').find(
            h => h.textContent.trim().toLowerCase() === label.toLowerCase()
        );
        if (!header) return [];
        const grid = header.nextElementSibling;
        if (!grid) return [];
        return Array.from(grid.querySelectorAll('button'));
    }

    function parseButtonClue(btn) {
        const spans = btn.querySelectorAll(':scope > span');
        const number = spans[0] ? spans[0].textContent.trim() : '';
        const text = spans[1] ? spans[1].textContent.trim() : '';
        return { number, text };
    }

    function parseClues() {
        const { model, rows, cols } = buildGridModel();

        const numberToCell = {};
        Object.values(model).forEach(cell => {
            if (cell.number) numberToCell[cell.number] = cell;
        });

        function withAnswers(list, direction) {
            return list.map(c => {
                const start = numberToCell[c.number];
                const answer = start
                    ? getAnswerPattern(start, direction, model, rows, cols)
                    : '';
                return { ...c, answer };
            });
        }

        const across = withAnswers(
            getClueButtons('Across')
                .map(parseButtonClue)
                .filter(c => c.number && c.text),
            'across'
        );

        const down = withAnswers(
            getClueButtons('Down')
                .map(parseButtonClue)
                .filter(c => c.number && c.text),
            'down'
        );

        if (!across.length && !down.length) return null;

        return { across, down };
    }

		// Grid model
    function buildGridModel() {
        const cells = deepQueryAll('[id^="cell-"]');
        const model = {};
        let maxRow = 0, maxCol = 0;

        cells.forEach(cell => {
            const m = cell.id.match(/^cell-(\d+)-(\d+)$/);
            if (!m) return;

            const row = parseInt(m[1], 10);
            const col = parseInt(m[2], 10);

            maxRow = Math.max(maxRow, row);
            maxCol = Math.max(maxCol, col);

            const blocked =
                cell.hasAttribute('disabled') ||
                cell.classList.contains('crossword-square-blocked');

            let letter = '';
            if (!blocked) {
                const letterSpan = cell.querySelector(
                    ':scope > span:not([data-crossword-cell-number])'
                );
                letter = letterSpan
                    ? letterSpan.textContent.trim().toUpperCase()
                    : '';
            }

            const numberSpan = cell.querySelector(
                ':scope > span[data-crossword-cell-number]'
            );

            const number = numberSpan
                ? numberSpan.textContent.trim()
                : null;

            model[`${row}-${col}`] = {
                row,
                col,
                blocked,
                letter,
                number
            };
        });

        return {
            model,
            rows: maxRow + 1,
            cols: maxCol + 1
        };
    }

    function getAnswerPattern(startCell, direction, model, rows, cols) {
        let { row, col } = startCell;
        let pattern = '';

        while (row < rows && col < cols) {
            const cell = model[`${row}-${col}`];
            if (!cell || cell.blocked) break;

            pattern += cell.letter || '_';

            if (direction === 'across')
                col++;
            else
                row++;
        }

        return pattern;
    }
  
    // Export
    function toMarkdown(data) {
        let md = '# Crossword Clues\n\n';

        md += '## ACROSS\n\n';
        md += '| # | Clue | Answer |\n';
        md += '|---|------|--------|\n';

        data.across.forEach(c => {
            md += `| ${c.number} | ${c.text} | ${c.answer} |\n`;
        });

        md += '\n## DOWN\n\n';
        md += '| # | Clue | Answer |\n';
        md += '|---|------|--------|\n';

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

    // Button shows up immediately on page load
    function init() {
        createButton();

        const observer = new MutationObserver(() => {
            if (!document.getElementById('puzzle-export-btn')) {
                createButton();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
