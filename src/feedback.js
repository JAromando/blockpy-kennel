import {arrayMove, capitalize, pyStr} from "./utilities";
import {runGPTPrompt} from "./openai";

export let FEEDBACK_HTML = `

<span class='blockpy-floating-feedback text-muted-less pull-right position-sticky sticky-top'
    aria-hidden="true" role="presentation" aria-label="New Feedback Alert">
    New feedback &uarr;
</span>

<div class='blockpy-feedback blockpy-panel'
            role="region" aria-label="Feedback"
            aria-live="polite"
            data-bind="class: ui.console.size">

    <!-- Feedback/Trace Visibility Control -->
    <!-- ko ifnot: ui.secondRow.hideTraceButton -->
    <button type='button'
            class='btn btn-sm btn-outline-secondary float-right'
            data-bind="click: ui.secondRow.advanceState">
        <span class='fas fa-eye'></span>
        <span data-bind="text: ui.secondRow.switchLabel"></span>
    </button>
    <!-- /ko -->
    
    <!-- Positive Feedback Region -->
    <div class="blockpy-feedback-positive float-right">
        
    
    </div>

    <!-- Actual Feedback Region -->    
    <div>
        <strong>Feedback: </strong>
        <span class='badge blockpy-feedback-category feedback-badge'
            data-bind="css: ui.feedback.badge,
                       text: ui.feedback.category">Feedback Kind</span>
        <small data-bind="text: (100*submission.score())+'%',
                          visible: display.instructor() && execution.feedback.label()"
            class="text-muted"></small>
        <small data-bind="click: ui.feedback.resetScore,
                          visible: display.instructor() && execution.feedback.label() && submission.score() > 0"
            class="text-muted" style="cursor: pointer"><u>(reset)</u></small>
    </div>
    <div>
        <strong class="blockpy-feedback-label"
            data-bind="text: execution.feedback.label"></strong>
        <div class="blockpy-feedback-message"
            data-bind="html: execution.feedback.message"></div>
        <div class="blockpy-feedback-openai"
            data-bind="text: execution.feedback.openai"></div>
    </div>
</div>
`;

export class BlockPyFeedback {

    /**
     * An object that manages the feedback area, where users are told the state of their
     * program's execution and given guidance. Also manages the creation of the Trace Table.
     *
     * @constructor
     * @this {BlockPyFeedback}
     * @param {Object} main - The main BlockPy instance
     * @param {HTMLElement} tag - The HTML object this is attached to.
     */
    constructor(main, tag) {
        this.main = main;
        this.tag = tag;

        this.feedbackModel = this.main.model.execution.feedback;

        this.category = this.tag.find(".blockpy-feedback-category");
        this.label = this.tag.find(".blockpy-feedback-label");
        this.message = this.tag.find(".blockpy-feedback-message");
        this.positive = this.tag.find(".blockpy-feedback-positive");
        this.openai = this.tag.find(".blockpy-feedback-openai");

        // TODO: If they change the student extra files, also update the dirty flag
        this.main.model.submission.code.subscribe(() => this.main.model.display.dirtySubmission(true));
    };

    /**
     * Moves the screen (takes 1 second) to make the Feedback area visible.
     */
    scrollIntoView() {
        $("html, body").animate({
            scrollTop: this.tag.offset().top
        }, 700);
    };

    /**
     * Determines if the feedback area is currently visible
     * @returns {boolean}
     */
    isFeedbackVisible() {
        let visibilityBuffer = 100;
        let topOfElement = this.tag.offset().top;
        //let bottomOfElement = this.tag.offset().top + this.tag.outerHeight();
        let bottomOfElement = topOfElement + visibilityBuffer;
        let bottomOfScreen = $(window).scrollTop() + $(window).height();
        let topOfScreen = $(window).scrollTop();
        //bottom_of_element -= 40; // User friendly padding
        return (
            (topOfElement < bottomOfScreen) &&
            (topOfScreen < bottomOfElement));
    };

    /**
     * Clears any output currently in the feedback area. Also resets the printer and
     * any highlighted lines in the editor.
     */
    clear(message="Ready") {
        this.feedbackModel.message(message);
        this.feedbackModel.openai("❗ OpenAI response will appear here!");
        this.feedbackModel.category(null);
        this.feedbackModel.label(null);
        this.feedbackModel.hidden(false);
        this.feedbackModel.linesError.removeAll();
        this.feedbackModel.linesUncovered.removeAll();
        this.clearPositiveFeedback();
        this.category.off("click");
    };

    static findFirstErrorLine(feedbackData) {
        if (feedbackData.quick$lookup) {
            let location = feedbackData.quick$lookup(new Sk.builtin.str("location"));
            if (location) {
                let line = location.tp$getattr(new Sk.builtin.str("line"));
                if (line) {
                    return Sk.ffi.remapToJs(line);
                }
            }
        }
        return null;
        /*for (let i = feedbackData.length-1; i >= 0; i-= 1) {
            if ("position" in feedbackData[i]) {
                return feedbackData[i].position.line;
            }
        }
        return null;*/
    };

    /**
     * Updates the model with these new execution results
     * @param executionResults
     * @param studentCode
     */
    updateFeedback(executionResults, studentCode) {
        // Parse out data
        let message = Sk.ffi.remapToJs(executionResults.MESSAGE);
        let category = Sk.ffi.remapToJs(executionResults.CATEGORY);
        let label = Sk.ffi.remapToJs(executionResults.LABEL);
        let hide = Sk.ffi.remapToJs(executionResults.HIDE);
        let data = executionResults.DATA;
        let positives = Sk.ffi.remapToJs(executionResults.POSITIVE);

        // Override based on assignments' settings
        let hideScore = this.main.model.assignment.hidden();
        if (hideScore && category.toLowerCase() === "complete") {
            category = "no errors";
            label = "No errors";
            message = "No errors reported.";
        }

        // Remap to expected BlockPy labels
        if (category.toLowerCase() === "instructor" && label.toLowerCase() === "explain") {
            label = "Instructor Feedback";
        }

        // Don't present a lack of error as being incorrect
        if (category === "Instructor" && label === "No errors") {
            category = "no errors";
        }

        // Update model accordingly
        message = this.main.utilities.markdown(message).replace(/<pre>\n/g, "<pre>\n\n");
        this.feedbackModel.message(message);
        this.feedbackModel.category(category);
        this.feedbackModel.label(label);
        //let highlightTimeout = setTimeout(() => {
        this.message.find("pre code").map( (i, block) => {
            window.hljs.highlightBlock(block);
        });
        //}, 400);
        // TODO: Instead of tracking student file, let's track the instructor file
        this.main.components.server.logEvent("Intervention", category, label, message, "answer.py");

        // Clear out any previously highlighted lines
        this.main.components.pythonEditor.bm.clearHighlightedLines();

        // Find the first error on a line and report that
        let line = BlockPyFeedback.findFirstErrorLine(data);
        this.feedbackModel.linesError.removeAll();
        if (line !== null && line !== undefined) {
            this.feedbackModel.linesError.push(line);
        }

        // Invert the set of traced lines
        let studentReport = this.main.model.execution.reports.student;
        this.feedbackModel.linesUncovered.removeAll();
        if (studentReport.success) {
            let uncoveredLines = [];
            this.main.model.execution.reports.parser.lines.forEach((line) => {
                if (studentReport.lines.indexOf(line) === -1) {
                    uncoveredLines.push(line);
                }
            });
            this.feedbackModel.linesUncovered(uncoveredLines);
        }

        for (let i=0; i<positives.length; i+=1) {
            let positiveData = positives[i];
            this.addPositiveFeedback(positiveData.message, "star", "green", () => this.main.components.dialog.POSITIVE_FEEDBACK_FULL(positiveData.title, positiveData.message));
        }

        // Run it through OpenAI
        this.feedbackModel.openai("Retrieving response...");
        runGPTPrompt(`This is my code:\n\n${studentCode}\n\nThis is the message I got:\n\n${message}\n\nSuggest code to fix the problem if one exists.`)
            .then(response => {
                this.feedbackModel.openai(response);
                console.log("OpenAI response: " + response);
            });
    }

    clearPositiveFeedback() {
        this.positive.empty();
        this.main.model.configuration.container.find(".blockpy-student-error").hide();
    }

    addPositiveFeedback(text, icon, color, onclick, toEnd) {
        let positive = $("<span></span>");
        positive.addClass("blockpy-feedback-positive-icon fas fa-"+icon);
        positive.css("color", color);
        positive.attr("title", text);
        if (toEnd) {
            this.positive.append(positive);
        } else {
            this.positive.prepend(positive);
        }
        positive.tooltip({"trigger": "hover", "container": this.main.model.configuration.attachmentPoint});
        if (onclick !== undefined) {
            positive.click(onclick);
        }
        positive.hover(() => {
            this.main.components.server.logEvent("X-Feedback", "positive", "hover", text, "");
        });
    }

    /**
     * Present any accumulated feedback
     */
    presentFeedback(executionResults, studentCode) {
        this.updateFeedback(executionResults, studentCode);

        this.category.off("click");
        if (this.main.model.display.instructor()) {
            this.updateFullFeedback(executionResults);
        }

        // TODO: Logging
        //this.main.components.server.logEvent("feedback", category+"|"+label, message);

        this.notifyFeedbackUpdate();
    };

    processSingleFeedback(element) {
        const title = element.tp$getattr(new pyStr("title")).toString();
        const category = capitalize(element.tp$getattr(new pyStr("category")).toString());
        const kind = element.tp$getattr(new pyStr("kind")).toString();
        const active = Sk.misceval.isTrue(element);
        let message = element.tp$getattr(new pyStr("message")).toString();
        const unused_message = element.tp$getattr(new pyStr("unused_message")).toString();
        message = message === "None" ? unused_message : message;
        const justification = element.tp$getattr(new pyStr("justification")).toString();
        const parent = element.tp$getattr(new pyStr("parent"));
        const hasParent = !Sk.builtin.checkNone(parent);
        let score = element.tp$getattr(new pyStr("resolved_score"));
        score = score === Sk.builtin.none.none$ ? ""
            : score.tp$name === "float"
                ? "+" + Math.round(score.v*100).toString() + "%"
                : score.toString();
        return [element, parent, `
        <div class="list-group-item flex-column align-items-start" ${hasParent ? "style='margin-left: 50px;'" : ""}>
            <div class="d-flex w-100 justify-content-between align-items-center">
                <span><strong class="mb-1" style="${active ? "" : "text-decoration: line-through;"}">${title}</strong> (${category} - ${kind})</span>
                <span class="badge badge-info badge-pill">${score}</span>
            </div>
            ${active ? "" : "<div>(Muted - Not shown to student)</div>"}
            <div class="mb-1 p-1 feedback-expand-on-click feedback-shrunk">
                ${message}
            </div>
            <small style="white-space: pre">${justification}</small>
        </div>
        `];
    }

    updateFullFeedback(executionResults) {
        console.log(executionResults);
        if (!("MAIN_REPORT" in executionResults)) {
            return;
        }
        let mainReport = executionResults.MAIN_REPORT;
        const feedback = mainReport.tp$getattr(new pyStr("feedback"));
        if (!feedback) {
            return;
        }
        let feedbacks = [];
        Sk.misceval.iterFor(feedback.tp$iter(), (element) => {
            feedbacks.push(this.processSingleFeedback(element));
        });
        Sk.misceval.iterFor(mainReport.tp$getattr(new pyStr("ignored_feedback")).tp$iter(), (element) => {
            feedbacks.push(this.processSingleFeedback(element));
        });
        const parents = new Map();
        for (let i = 0; i < feedbacks.length; i += 1) {
            const [element, parent, text] = feedbacks[i];
            const hasParent = !Sk.builtin.checkNone(parent);
            if (hasParent) {
                if (!parents.has(parent)) {
                    parents.set(parent, []);
                }
                parents.get(parent).push(text);
            } else {
                if (!parents.has(element)) {
                    parents.set(element, []);
                }
                parents.get(element).unshift(text);
            }
        }
        feedbacks = [...parents.values()].flat();
        this.category.on("click", () => {
            this.main.components.dialog.show("Full Feedback Information", '<div class="list-group">'+
                feedbacks.join("\n") + "</div>");
            $(".feedback-expand-on-click").on("click", (event) => {
                $(event.target).toggleClass("feedback-shrunk");
            });
        });
    }

    notifyFeedbackUpdate() {
        if (!this.isFeedbackVisible()) {
            this.tag.find(".blockpy-floating-feedback").show().fadeOut(7000);
            if (this.shouldScrollIntoView()) {
                this.scrollIntoView();
            }
        }
    };

    shouldScrollIntoView() {
        return !this.main.model.ui.smallLayout();
    }

    presentRunError(error, just_return) {
        if (just_return === undefined) {
            just_return = false;
        }
        let message, label, category, lineno;
        label = error.tp$name;
        category = "runtime";
        message = this.convertSkulptError(error);

        if (just_return) {
            return message;
        }
        this.feedbackModel.message(message);
        this.feedbackModel.category(category);
        this.feedbackModel.label(label);
        this.feedbackModel.linesError.removeAll();
        if (lineno !== undefined && lineno !== null) {
            this.feedbackModel.linesError.push(lineno);
        }
    }

    buildTraceback(error, filenameExecuted) {
        return error.traceback.map(frame => {
            if (!frame) {
                return "??";
            }
            let lineno = frame.lineno;
            if (frame.filename.slice(0, -3) === filenameExecuted) {
                lineno -= this.main.model.execution.reports.instructor.lineOffset;
            }
            let file = `File <code class="filename">"${frame.filename}"</code>, `;
            let line = `on line <code class="lineno">${lineno}</code>, `;
            let scope = (frame.scope !== "<module>" &&
            frame.scope !== undefined) ? `in scope ${frame.scope}` : "";
            let source = "";
            if (frame.source !== undefined) {
                source = `\n<pre><code>${frame.source}</code></pre>`;
            }
            return file + line + scope + source;
        });
    }

    convertSkulptError(error, filenameExecuted, isInstructor) {
        let name = error.tp$name;
        let args = Sk.ffi.remapToJs(error.args);
        let top = `${name}: ${args[0]}\n<br>\n<br>`;
        let traceback = "";
        if (name === "TimeoutError") {
            if (error.err && error.err.traceback && error.err.traceback.length) {
                const allFrames = this.buildTraceback(error.err, filenameExecuted);
                const result = ["Traceback:"];
                if (allFrames.length > 5) {
                    result.push(...allFrames.slice(0, 3),
                                `... Hiding ${allFrames.length - 3} other stack frames ...,`,
                                ...allFrames.slice(-3, -2));
                } else {
                    result.push(...allFrames);
                }
                traceback = result.join("\n<br>");
            }
        } else {
            if (isInstructor) {
                top = "Error in instructor feedback. Please show the following to an instructor:<br>\n"+top;
            }
            if (error.traceback && error.traceback.length) {
                traceback = "Traceback:<br>\n" + this.buildTraceback(error, filenameExecuted).join("\n<br>");
            }
        }
        return top+"\n"+traceback;
    }

    presentInternalError(error, filenameExecuted) {
        if (error.tp$name === "TimeoutError") {
            this.main.model.execution.feedback.category("runtime");
            this.main.model.execution.feedback.label("Timeout Error");
        } else {
            this.main.model.execution.feedback.category("internal");
            this.main.model.execution.feedback.label("Internal Error");
        }
        let message = this.convertSkulptError(error, filenameExecuted, true);
        this.main.model.execution.feedback.message(message);

        this.notifyFeedbackUpdate();

        this.main.components.server.logEvent("X-System.Error", "internal", "Internal Error", message, filenameExecuted);
    }
}