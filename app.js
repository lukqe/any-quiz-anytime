// app.js
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for DB initialization
    await window.quizDB.init();

    // UI Elements
    const viewList = document.getElementById('view-list');
    const viewQuiz = document.getElementById('view-quiz');
    const viewAdmin = document.getElementById('view-admin');
    const quizListContainer = document.getElementById('quiz-list');
    const fileUpload = document.getElementById('file-upload');
    const btnBack = document.getElementById('btn-back');
    const deleteModal = document.getElementById('delete-modal');
    const modalQuizList = document.getElementById('modal-quiz-list');
    const btnCancelDelete = document.getElementById('btn-cancel-delete');

    // Quiz View Elements
    const quizContainer = document.getElementById('quiz-container');
    const progressBar = document.getElementById('progress-bar');
    const scoreDisplay = document.getElementById('score-display');

    // State
    let currentQuiz = null;
    let currentProgress = null;
    let currentAdminEditId = null;

    // Check if we need to load the default example quiz
    const quizzesCount = await window.quizDB.getQuizzesCount();
    if (quizzesCount === 0) {
        await loadDefaultQuiz();
    }

    await renderQuizList();

    // Event Listeners
    fileUpload.addEventListener('change', handleFileUpload);
    btnBack.addEventListener('click', () => switchView('list'));
    document.getElementById('btn-go-admin').addEventListener('click', () => switchView('admin'));
    document.getElementById('btn-admin-back').addEventListener('click', () => switchView('list'));
    document.getElementById('btn-admin-wipe-all').addEventListener('click', wipeAllDatabases);
    btnCancelDelete.addEventListener('click', () => deleteModal.classList.remove('active'));

    // Admin Edit Events
    document.getElementById('btn-admin-cancel').addEventListener('click', () => { document.getElementById('admin-edit-modal').classList.remove('active'); currentAdminEditId = null; });
    document.getElementById('btn-admin-save').addEventListener('click', saveAdminEdit);

    // Functions
    function switchView(viewName) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active-view'));
        if (viewName === 'list') {
            viewList.classList.add('active-view');
            renderQuizList();
            currentQuiz = null;
        } else if (viewName === 'quiz') {
            viewQuiz.classList.add('active-view');
        } else if (viewName === 'admin') {
            document.getElementById('view-admin').classList.add('active-view');
            renderAdminList();
        }
    }

    async function loadDefaultQuiz() {
        try {
            const resp = await fetch('example.md');
            if (resp.ok) {
                const text = await resp.text();
                const parsed = window.parseQuizMarkdown(text);
                if (parsed.length > 0) {
                    await window.quizDB.saveQuiz({
                        id: 'default-example',
                        name: 'Example Quiz',
                        questions: parsed,
                        rawMarkdown: text,
                        timestamp: Date.now()
                    });
                }
            }
        } catch (e) {
            console.log("No example.md found to load.");
        }
    }

    async function renderQuizList() {
        quizListContainer.innerHTML = '';
        const quizzes = await window.quizDB.getAllQuizzes();

        const sortedQuizzes = quizzes.sort((a, b) => b.timestamp - a.timestamp);
        for (const quiz of sortedQuizzes) {
            const card = document.createElement('div');
            card.className = 'quiz-card';

            const title = document.createElement('h3');
            title.textContent = quiz.name;

            const meta = document.createElement('div');
            meta.className = 'meta';
            meta.textContent = `${quiz.questions.length} Questions`;

            const progress = await window.quizDB.getProgress(quiz.id);
            const isStarted = Object.keys(progress.answers).length > 0;
            const isCompleted = progress.currentIndex >= quiz.questions.length;

            const actions = document.createElement('div');
            actions.className = 'quiz-actions';

            const startBtn = document.createElement('button');
            startBtn.className = 'btn primary-btn small-btn';
            if (isCompleted) {
                startBtn.textContent = 'Review';
            } else if (isStarted) {
                startBtn.textContent = 'Resume';
            } else {
                startBtn.textContent = 'Start';
            }
            startBtn.onclick = () => openQuiz(quiz);

            const resetBtn = document.createElement('button');
            resetBtn.className = 'btn secondary-btn small-btn';
            resetBtn.textContent = 'Reset';
            resetBtn.style.display = isStarted ? 'inline-flex' : 'none';
            resetBtn.onclick = async () => {
                if (confirm(`Are you sure you want to reset your progress for "${quiz.name}"?`)) {
                    progress.currentIndex = 0;
                    progress.answers = {};
                    await window.quizDB.saveProgress(progress);
                    renderQuizList();
                }
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'btn secondary-btn small-btn delete-btn';
            delBtn.textContent = 'Delete';
            delBtn.onclick = async () => {
                if (confirm(`Are you sure you want to permanently delete "${quiz.name}" and all your progress?`)) {
                    await window.quizDB.deleteQuiz(quiz.id);
                    renderQuizList();
                }
            };
            const downBtn = document.createElement('button');
            downBtn.className = 'btn secondary-btn small-btn';
            downBtn.textContent = 'Download';
            downBtn.onclick = (e) => {
                e.stopPropagation();
                const content = quiz.rawMarkdown || "#### **QUESTION: 1**\\n\\nFallback content for older quizzes.";
                const blob = new Blob([content], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = quiz.name + '.md';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            };

            actions.appendChild(startBtn);
            if (isStarted) actions.appendChild(resetBtn);
            actions.appendChild(downBtn);
            actions.appendChild(delBtn);

            card.appendChild(title);
            card.appendChild(meta);
            card.appendChild(actions);

            quizListContainer.appendChild(card);
        }

        if (quizzes.length === 0) {
            quizListContainer.innerHTML = `<p style="color:var(--text-muted);">No quizzes found. Upload a markdown file to begin.</p>`;
        }
    }

    async function handleFileUpload(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const count = await window.quizDB.getQuizzesCount();
        if (count + files.length > 10) {
            showDeleteModal(files);
            return;
        }

        for (const file of files) {
            await processFile(file);
        }

        fileUpload.value = ''; // reset
        renderQuizList();
    }

    async function processFile(file) {
        const text = await file.text();
        const parsed = window.parseQuizMarkdown(text);
        if (parsed.length > 0) {
            await window.quizDB.saveQuiz({
                id: 'quiz_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
                name: file.name.replace('.md', ''),
                questions: parsed,
                rawMarkdown: text,
                timestamp: Date.now()
            });
        } else {
            alert(`No questions could be parsed from ${file.name}`);
        }
    }

    async function showDeleteModal(pendingFiles) {
        modalQuizList.innerHTML = '';
        const quizzes = await window.quizDB.getAllQuizzes();

        quizzes.forEach(quiz => {
            const item = document.createElement('div');
            item.className = 'modal-quiz-item';

            const name = document.createElement('span');
            name.textContent = quiz.name;

            const delBtn = document.createElement('button');
            delBtn.textContent = 'Delete';
            delBtn.onclick = async () => {
                await window.quizDB.deleteQuiz(quiz.id);
                // Check if we have space now
                const newCount = await window.quizDB.getQuizzesCount();
                if (newCount + pendingFiles.length <= 10) {
                    deleteModal.classList.remove('active');
                    for (const file of pendingFiles) await processFile(file);
                    fileUpload.value = '';
                    renderQuizList();
                } else {
                    item.remove(); // update modal visually
                }
            };

            item.appendChild(name);
            item.appendChild(delBtn);
            modalQuizList.appendChild(item);
        });

        deleteModal.classList.add('active');
    }

    // --- Quiz UI Logic ---
    async function openQuiz(quiz) {
        currentQuiz = quiz;
        currentProgress = await window.quizDB.getProgress(quiz.id);

        if (currentProgress.currentIndex >= quiz.questions.length) {
            // Give option to restart if completed
            if (confirm("You have completed this quiz. Restart?")) {
                currentProgress.currentIndex = 0;
                currentProgress.answers = {};
                await window.quizDB.saveProgress(currentProgress);
            } else {
                return;
            }
        }

        switchView('quiz');
        renderCurrentQuestion();
    }

    function renderCurrentQuestion() {
        const qIndex = currentProgress.currentIndex;
        if (qIndex >= currentQuiz.questions.length) {
            // Quiz completed
            quizContainer.innerHTML = `<div style="text-align:center; padding: 40px 0;"><h2>Quiz Completed! 🎉</h2><p>You have finished ${currentQuiz.name}</p><button class="btn primary-btn" style="margin-top: 24px;" onclick="document.getElementById('btn-back').click()">Back to Menu</button></div>`;
            renderQuestionNav();
            return;
        }

        const question = currentQuiz.questions[qIndex];
        const answered = currentProgress.answers[qIndex]; // { selected: 'A', correct: true }

        // Update header
        const progressPercent = ((qIndex) / currentQuiz.questions.length) * 100;
        progressBar.style.width = `${progressPercent}%`;

        const correctCount = Object.values(currentProgress.answers).filter(a => a.correct).length;
        scoreDisplay.textContent = `${correctCount}/${currentQuiz.questions.length}`;

        // Render Question
        quizContainer.innerHTML = '';

        // Question number label
        const qNum = document.createElement('div');
        qNum.style.cssText = 'color:var(--text-muted); font-size:0.85rem; margin-bottom:8px;';
        qNum.textContent = `Question ${qIndex + 1} of ${currentQuiz.questions.length}`;
        quizContainer.appendChild(qNum);

        // Using marked to parse code blocks safely in question text
        const qContent = document.createElement('div');
        qContent.className = 'question-content';
        qContent.innerHTML = window.marked ? window.marked.parse(question.questionText) : question.questionText;
        quizContainer.appendChild(qContent);

        // Options
        const optionsList = document.createElement('div');
        optionsList.className = 'options-list';

        question.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<span class="label">${opt.id}</span> ${opt.text}`;

            if (answered) {
                btn.disabled = true;
                const isThisOptionCorrect = question.correctAnswers.includes(opt.id);
                const isThisOptionSelected = answered.selected === opt.id;

                if (isThisOptionCorrect && isThisOptionSelected) {
                    btn.classList.add('selected-correct');
                } else if (!isThisOptionCorrect && isThisOptionSelected) {
                    btn.classList.add('selected-wrong');
                } else if (isThisOptionCorrect) {
                    btn.classList.add('correct');
                }
            } else {
                btn.onclick = () => selectOption(opt.id, question.correctAnswers);
            }

            optionsList.appendChild(btn);
        });

        quizContainer.appendChild(optionsList);

        // Explanation
        if (answered) {
            const expDiv = document.createElement('div');
            expDiv.className = 'explanation-card';
            let expHtml = '<h4>Explanation</h4>';
            expHtml += window.marked ? window.marked.parse(question.explanation) : `<p>${question.explanation}</p>`;

            if (question.reference) {
                expHtml += `<br><h4>Reference</h4>`;
                expHtml += window.marked ? window.marked.parse(question.reference) : `<p>${question.reference}</p>`;
            }

            // Ensure all links open safely in a new tab
            expHtml = expHtml.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');

            expDiv.innerHTML = expHtml;
            quizContainer.appendChild(expDiv);

            // Next button
            const nextAction = document.createElement('div');
            nextAction.className = 'next-action';
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn primary-btn';
            nextBtn.textContent = qIndex === currentQuiz.questions.length - 1 ? 'Finish' : 'Next Question';
            nextBtn.onclick = async () => {
                currentProgress.currentIndex++;
                await window.quizDB.saveProgress(currentProgress);
                renderCurrentQuestion();
            };
            nextAction.appendChild(nextBtn);
            quizContainer.appendChild(nextAction);
        }

        // Render navigator
        renderQuestionNav();
    }

    function renderQuestionNav() {
        const nav = document.getElementById('question-nav');
        nav.innerHTML = '';
        const total = currentQuiz.questions.length;

        for (let i = 0; i < total; i++) {
            const pill = document.createElement('button');
            pill.className = 'q-pill';
            pill.textContent = i + 1;

            const ans = currentProgress.answers[i];
            if (ans) {
                pill.classList.add(ans.correct ? 'correct' : 'wrong');
            }
            if (i === currentProgress.currentIndex) {
                pill.classList.add('active');
            }

            pill.onclick = async () => {
                currentProgress.currentIndex = i;
                await window.quizDB.saveProgress(currentProgress);
                renderCurrentQuestion();
            };

            nav.appendChild(pill);
        }
    }

    async function selectOption(selectedId, correctAnswers) {
        const isCorrect = correctAnswers.includes(selectedId);
        currentProgress.answers[currentProgress.currentIndex] = {
            selected: selectedId,
            correct: isCorrect
        };
        await window.quizDB.saveProgress(currentProgress);

        const autoAdvance = document.getElementById('auto-advance-toggle').checked;
        if (autoAdvance) {
            currentProgress.currentIndex++;
            await window.quizDB.saveProgress(currentProgress);
        }

        renderCurrentQuestion();
    }

    async function wipeAllDatabases() {
        if (!confirm("Are you REALLY sure you want to permanently delete ALL quizzes and progress? This cannot be undone.")) return;
        const quizzes = await window.quizDB.getAllQuizzes();
        for (const q of quizzes) {
            await window.quizDB.deleteQuiz(q.id);
        }
        renderAdminList();
        alert("Database wiped.");
    }

    async function renderAdminList() {
        const container = document.getElementById('admin-quiz-list');
        container.innerHTML = '';
        const quizzes = await window.quizDB.getAllQuizzes();

        const sortedQuizzes = quizzes.sort((a, b) => b.timestamp - a.timestamp);
        for (const quiz of sortedQuizzes) {
            const progress = await window.quizDB.getProgress(quiz.id);
            const answeredCount = Object.keys(progress.answers).length;
            const correctCount = Object.values(progress.answers).filter(a => a.correct).length;
            const wrongCount = answeredCount - correctCount;

            const card = document.createElement('div');
            card.className = 'quiz-card block-card';
            card.style.cursor = 'default';

            // Top row: name + actions
            const topRow = document.createElement('div');
            topRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;';

            const info = document.createElement('div');
            info.innerHTML = `<strong>${quiz.name}</strong> <span style="color:var(--text-muted); font-size:0.8em;">(${quiz.id})</span>`;

            const actions = document.createElement('div');
            actions.className = 'quiz-actions';
            actions.style.marginTop = '0';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn primary-btn small-btn';
            editBtn.textContent = 'Edit Raw MD';
            editBtn.onclick = () => openAdminEdit(quiz);

            const delBtn = document.createElement('button');
            delBtn.className = 'btn secondary-btn small-btn delete-btn';
            delBtn.textContent = 'Delete';
            delBtn.onclick = async () => {
                if (confirm(`Delete "${quiz.name}"?`)) {
                    await window.quizDB.deleteQuiz(quiz.id);
                    renderAdminList();
                }
            };

            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            topRow.appendChild(info);
            topRow.appendChild(actions);
            card.appendChild(topRow);

            // State data section
            const stateDiv = document.createElement('div');
            stateDiv.style.cssText = 'background:#000; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:12px; font-family:monospace; font-size:0.8rem; color:var(--text-muted); overflow-x:auto;';

            const stateInfo = `Questions: ${quiz.questions.length}  |  Current Index: ${progress.currentIndex}  |  Answered: ${answeredCount}  |  ✓ ${correctCount}  ✗ ${wrongCount}`;

            // Build per-question breakdown
            let breakdown = '';
            for (let i = 0; i < quiz.questions.length; i++) {
                const ans = progress.answers[i];
                if (ans) {
                    breakdown += `  Q${i + 1}: ${ans.selected} ${ans.correct ? '✓' : '✗'}`;
                }
            }

            stateDiv.innerHTML = `<div style="margin-bottom:4px;">${stateInfo}</div>`;
            if (breakdown) {
                stateDiv.innerHTML += `<div style="color:var(--text-main); word-break:break-all;">${breakdown}</div>`;
            }
            card.appendChild(stateDiv);

            container.appendChild(card);
        }

        if (quizzes.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted);">No data in DB.</p>`;
        }
    }

    async function openAdminEdit(quiz) {
        currentAdminEditId = quiz.id;
        document.getElementById('admin-edit-title').textContent = `Edit Markdown: ${quiz.name} `;

        // Ensure robust raw Markdown logic
        let raw = quiz.rawMarkdown;
        if (!raw) {
            raw = quiz.questions.map((q, i) => `#### ** QUESTION: ${i + 1}**\\n\\n${q.questionText} \\n\\n${q.options.map(o => `${o.id}. ${o.text}`).join('\\n')} \\n\\n ** Answer(s):** ${q.correctAnswers.join(', ')} \\n\\n##### ** Explanation:**\\n${q.explanation} \\n\\n##### ** Reference:**\\n${q.reference} `).join('\\n\\n\\n');
        }

        document.getElementById('admin-edit-textarea').value = raw;
        document.getElementById('admin-edit-modal').classList.add('active');
    }

    async function saveAdminEdit() {
        if (!currentAdminEditId) return;
        const newRaw = document.getElementById('admin-edit-textarea').value;
        try {
            const parsed = window.parseQuizMarkdown(newRaw);
            if (parsed.length === 0) {
                alert("Could not parse any valid questions. Ensure the format uses: #### **QUESTION: 1**");
                return;
            }

            // Get original to preserve name and timestamp
            const original = await window.quizDB.getQuiz(currentAdminEditId);
            original.questions = parsed;
            original.rawMarkdown = newRaw;

            await window.quizDB.saveQuiz(original);
            document.getElementById('admin-edit-modal').classList.remove('active');
            renderAdminList();
            alert("Quiz updated successfully.");
        } catch (e) {
            alert(`Error parsing updated markdown: ${e.message}`);
        }
    }
});
