// parser.js
function parseQuizMarkdown(markdown) {
    const questions = [];
    // Split by the question header
    const chunks = markdown.split(/#### \*\*QUESTION: \d+\*\*/g);
    
    // The first split often contains intro text before the first question, we can skip it.
    for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i].trim();
        if (!chunk) continue;
        
        try {
            questions.push(parseSingleQuestionChunk(chunk));
        } catch (e) {
            console.warn("Failed to parse a question chunk. It might not be a question. " + e.message);
        }
    }
    return questions;
}

function parseSingleQuestionChunk(chunk) {
    // We need to carefully split sections.
    // The structure usually is:
    // [Question Body and Code]
    // A. Option ...
    // B. Option ...
    // ...
    // **Answer(s):** [A, B...]
    // ##### **Explanation:**
    // [Explanation text]
    // ##### **Reference:**
    // [Reference link]

    let questionText = "";
    const options = [];
    let answerString = "";
    let explanation = "";
    let reference = "";

    // Regular expressions
    // Matches "A. something" at the start of a line
    const optionsRegex = /^([A-Z])\.\s+(.*)$/gm;
    const answerRegex = /\*\*Answer\(s\):\*\*\s*([A-Z, ]+)/i;
    const explanationSplit = /##### \*\*Explanation:\*\*/i;
    const referenceSplit = /##### \*\*Reference:\*\*/i;

    // 1. Find Answer
    const answerMatch = chunk.match(answerRegex);
    if (!answerMatch) {
         throw new Error("No answer found.");
    }
    answerString = answerMatch[1].trim();
    // Parse answers into array (handling "A, B" or "A")
    const correctAnswers = answerString.split(',').map(s => s.trim()).filter(Boolean);

    // 2. Extract Options
    let optionMatch;
    let firstOptionIndex = -1;
    let lastOptionEndIndex = -1;
    
    while ((optionMatch = optionsRegex.exec(chunk)) !== null) {
        if (firstOptionIndex === -1) firstOptionIndex = optionMatch.index;
        options.push({
            id: optionMatch[1],
            text: optionMatch[2].trim()
        });
        lastOptionEndIndex = optionsRegex.lastIndex;
    }

    if (options.length === 0) {
        throw new Error("No options found.");
    }

    // 3. Question Text (everything before the first option string)
    questionText = chunk.substring(0, firstOptionIndex).trim();

    // 4. Explanation and Reference
    // They appear after the options and answer.
    const partsByExp = chunk.split(explanationSplit);
    if (partsByExp.length > 1) {
        const afterExp = partsByExp[1];
        const partsByRef = afterExp.split(referenceSplit);
        explanation = partsByRef[0].trim();
        if (partsByRef.length > 1) {
            reference = partsByRef[1].trim();
        }
    } else {
        // Support files without explanation section if needed, or check if ref exists without expl
        const partsByRef = chunk.split(referenceSplit);
        if (partsByRef.length > 1) {
            reference = partsByRef[1].trim();
        }
    }

    return {
        questionText,
        options,
        correctAnswers,
        explanation,
        reference
    };
}

window.parseQuizMarkdown = parseQuizMarkdown;
