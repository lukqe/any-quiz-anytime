// db.js
const DB_NAME = 'AQA_DB';
const DB_VERSION = 1;

class QuizDB {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => reject(event.target.error);

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store quizes metadata and parsed questions
                if (!db.objectStoreNames.contains('quizzes')) {
                    db.createObjectStore('quizzes', { keyPath: 'id' });
                }

                // Store user progress per quiz
                if (!db.objectStoreNames.contains('progress')) {
                    db.createObjectStore('progress', { keyPath: 'quizId' });
                }
            };
        });
    }

    // Quizzes
    async getAllQuizzes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['quizzes'], 'readonly');
            const store = transaction.objectStore('quizzes');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getQuiz(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['quizzes'], 'readonly');
            const store = transaction.objectStore('quizzes');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveQuiz(quiz) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['quizzes'], 'readwrite');
            const store = transaction.objectStore('quizzes');
            const request = store.put(quiz);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteQuiz(id) {
        return new Promise(async (resolve, reject) => {
            const transaction = this.db.transaction(['quizzes', 'progress'], 'readwrite');
            transaction.objectStore('quizzes').delete(id);
            transaction.objectStore('progress').delete(id);
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
        });
    }

    async getQuizzesCount() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['quizzes'], 'readonly');
            const store = transaction.objectStore('quizzes');
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Progress
    async getProgress(quizId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['progress'], 'readonly');
            const store = transaction.objectStore('progress');
            const request = store.get(quizId);
            request.onsuccess = () => resolve(request.result || { quizId: quizId, answers: {}, currentIndex: 0 });
            request.onerror = () => reject(request.error);
        });
    }

    async saveProgress(progress) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['progress'], 'readwrite');
            const store = transaction.objectStore('progress');
            const request = store.put(progress);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

window.quizDB = new QuizDB();
