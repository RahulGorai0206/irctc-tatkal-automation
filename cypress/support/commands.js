import {
    formatDate,
    hasTatkalAlreadyOpened,
    tatkalOpenTimeForToday,
} from "../utils";

const MANUAL_CAPTCHA = Cypress.env("MANUAL_CAPTCHA");
const ENABLE_CAPTCHA_CHECK = Cypress.env("ENABLE_CAPTCHA_CHECK") !== false;

Cypress.on("uncaught:exception", (err, runnable) => {
    // returning false here prevents Cypress from failing the test
    return false;
});

Cypress.Commands.add("submitCaptcha", () => {
    let LOGGED_IN = false;
    performLogin(LOGGED_IN);
});

Cypress.Commands.add("solveCaptcha", () => {
    solveCaptcha();
});

Cypress.Commands.add(
    "bookUntilTatkalGetsOpen",
    (div, TRAIN_COACH, TRAVEL_DATE, TRAIN_NO, TATKAL) => {
        BOOK_UNTIL_TATKAL_OPENS(
            div,
            TRAIN_COACH,
            TRAVEL_DATE,
            TRAIN_NO,
            TATKAL
        );
    }
);

function performLogin(LOGGED_IN) {
    if (!LOGGED_IN) {
        cy.wait(500);

        cy.get("body")
        .should("be.visible")
        .then((el) => {
            if (el[0].innerText.includes("Logout")) {
                cy.task("log", "We have logged in successfully at this stage");
            } else if (
                el[0].innerText.includes("FORGOT ACCOUNT DETAILS") &&
                !el[0].innerText.includes("Please Wait...")
            ) {
                if (MANUAL_CAPTCHA) {
                    if (Cypress.$(".captcha-img").length > 0) {
                        cy.get("#captcha").focus();
                    } else {
                        cy.task("log", "No captcha image found, waiting for manual interaction or clicking SIGN IN...");
                    }
                    // Wait for user to manually enter captcha and login
                    cy.get(".search_btn.loginText", { timeout: 60000 })
                    .should("include.text", "Logout")
                    .then(() => {
                        performLogin(true);
                    });
                } else {
                    // Use the local server to solve the captcha or login directly if missing
                    cy.get("body").then(($body) => {
                        if (ENABLE_CAPTCHA_CHECK && $body.find(".captcha-img").length > 0) {
                            cy.get(".captcha-img")
                            .invoke("attr", "src")
                            .then((value) => {
                                // API call to retrieve captcha value
                                cy.request({
                                    method: "POST",
                                    url: "http://localhost:5000/extract-text",
                                    body: {
                                        image: value,
                                    },
                                }).then((response) => {
                                    const extractedText = response.body.extracted_text;
                                    
                                    // Sometimes the captcha input field has a different selector
                                    if ($body.find("#captcha").length > 0) {
                                        cy.get("#captcha").clear().type(extractedText).type("{enter}");
                                    } else {
                                        cy.contains("SIGN IN").click();
                                    }

                                    cy.get("body").then((el) => {
                                        if (el[0].innerText.includes("Invalid Captcha")) {
                                            performLogin(false);
                                        } else if (el[0].innerText.includes("Logout")) {
                                            performLogin(true);
                                        } else {
                                            performLogin(false);
                                        }
                                    });
                                });
                            });
                        } else {
                            // No captcha image found, try clicking SIGN IN directly
                            cy.task("log", "No captcha image found. Attempting to click SIGN IN directly.");
                            cy.contains("SIGN IN").click();
                            
                            // Cypress will automatically retry until the Logout element is found or it times out
                            cy.contains("Logout", { timeout: 60000 }).then(() => {
                                cy.task("log", "Logged in successfully!");
                                performLogin(true);
                            });
                        }
                    });
                }
            } else {
                // Neither Logout nor "FORGOT" is present. This usually means the page is loading or transitioning.
                cy.task("log", "Waiting for page transition or loading...");
                cy.contains("Logout", { timeout: 120000 }).then(() => {
                    performLogin(true);
                });
            }
        });
    }
}

let MAX_ATTEMPT = 120;
// function to solveCaptcha after logging in

function solveCaptcha() {
    MAX_ATTEMPT -= 1;
    cy.wrap(MAX_ATTEMPT, { timeout: 10000 }).should("be.gt", 0);

    cy.wait(500);
    cy.get("body")
    .should("be.visible")
    .then((el) => {
        if (
            el[0].innerText.includes(
                "Unable to process current transaction"
            ) &&
            el[0].innerText.includes("Payment Mode")
        ) {
            cy.get(".train_Search").click();
            cy.wait(1000);
        }

        if (el[0].innerText.includes("Sorry!!! Please Try again!!")) {
            throw new Error("Sorry!!! Please Try again!! <<< Thrown By IRCTC");
        }

        if (el[0].innerText.includes("Payment Methods")) {
            return;
        }

        if (el[0].innerText.includes("No seats available")) {
            cy.fail("Further execution stopped because there are no more tickets.");
        }

        if (
            el[0].innerText.includes("Your ticket will be sent to") &&
            !el[0].innerText.includes("Please Wait...") &&
            el[0].innerHTML.includes("Enter Captcha")
        ) {
            if (MANUAL_CAPTCHA) {
                cy.get("#captcha").focus();
                cy.get("body").then((el) => {
                    if (el[0].innerText.includes("Payment Methods")) {
                        cy.task("log", "Bypassed Captcha");
                    }
                });
            } else {
                cy.get("body").then(($body) => {
                    if (ENABLE_CAPTCHA_CHECK && $body.find(".captcha-img").length > 0) {
                        cy.get(".captcha-img")
                        .invoke("attr", "src")
                        .then((value) => {
                            // Use the local server to solve the captcha
                            cy.request({
                                method: "POST",
                                url: "http://localhost:5000/extract-text",
                                body: {
                                    image: value,
                                },
                            }).then((response) => {
                                const extractedText = response.body.extracted_text;
                                cy.get("#captcha")
                                .clear()
                                .type(extractedText)
                                .type("{enter}");

                                cy.get("body").then((el) => {
                                    if (el[0].innerText.includes("Payment Methods")) {
                                        cy.task("log", "Bypassed Captcha");
                                    } else {
                                        solveCaptcha();
                                    }
                                });
                            });
                        });
                        solveCaptcha();
                    } else {
                        cy.task("log", "No inner captcha found. Moving to payment if possible.");
                        cy.contains("Continue", { matchCase: false }).click({ force: true });
                        cy.wait(2000);
                        solveCaptcha();
                    }
                });
            }
        } else if (el[0].innerText.includes("Payment Methods")) {
            return;
        } else {
            solveCaptcha();
        }
    });
}

function BOOK_UNTIL_TATKAL_OPENS(
    div,
    TRAIN_COACH,
    TRAVEL_DATE,
    TRAIN_NO,
    TATKAL
) {
    cy.wait(1900);

    if (TATKAL && !hasTatkalAlreadyOpened(TRAIN_COACH)) {
        // wait for exact time
        // cy.task("log", "Waiting for the exact time of opening of TATKAL...");
        const exactTimeToOpen = tatkalOpenTimeForToday(TRAIN_COACH);
        cy.get("div.h_head1", { timeout: 300000 }).should(
            "include.text",
            exactTimeToOpen
        );
    }

    cy.get("body")
        .should("be.visible")
        .then((el) => {
            if (
                el[0].innerText.includes(
                    "Booking not yet started for the selected quota and class"
                ) &&
                !el[0].innerText.includes("Please Wait...")
            ) {
                cy.get(
                    ".level_1.hidden-xs > app-modify-search > .layer_2 > form.ng-untouched > .col-md-2 > .hidden-xs"
                ).click();

                // Another layer of protection from breaking up the code
                // we again check the body are we at any loading phase as in loading phase content becomes visible but div
                // not active to click it
                // body fetch block starts............
                cy.get("body")
                    .should("be.visible")
                    .then((el) => {
                        if (
                            el[0].innerText.includes(
                                "Booking not yet started for the selected quota and class"
                            ) &&
                            !el[0].innerText.includes("Please Wait...")
                        ) {
                            // iterating each block div of available trains starts here.....
                            cy.get(":nth-child(n) > .bull-back")
                                .should("be.visible")
                                .each((div, index) => {
                                    // confirming we click on same train no and seat class div
                                    if (
                                        div[0].innerText.includes(TRAIN_NO) &&
                                        div[0].innerText.includes(TRAIN_COACH)
                                    ) {
                                        console.log(index,"index no -<<<<<<<<<<<<<<<<<,")
                                        cy.wrap(div)
                                            .contains(TRAIN_COACH)
                                            .click();
                                        cy.get(
                                            `:nth-child(n) > .bull-back > app-train-avl-enq > :nth-child(1) > :nth-child(7) > :nth-child(1)`
                                        )
                                            .contains(formatDate(TRAVEL_DATE))
                                            .click();
                                        cy.get(
                                            `:nth-child(n) > .bull-back > app-train-avl-enq > [style="padding-top: 10px; padding-bottom: 20px;"]`
                                        )
                                        // :nth-child(8) > .form-group > app-train-avl-enq > [style="padding-top: 10px; padding-bottom: 20px;"] > [style="overflow-x: auto;"] > .pull-left > :nth-child(1) > .train_Search
                                            .contains("Book Now")
                                            .click();
                                        BOOK_UNTIL_TATKAL_OPENS(
                                            div,
                                            TRAIN_COACH,
                                            TRAVEL_DATE,
                                            TRAIN_NO,
                                            TATKAL
                                        );
                                    }
                                });
                            // iterating each block div of available trains ends here.....
                        } else {
                            BOOK_UNTIL_TATKAL_OPENS(
                                div,
                                TRAIN_COACH,
                                TRAVEL_DATE,
                                TRAIN_NO,
                                TATKAL
                            );
                        }
                    });
                // body fetch block ends............
            } else if (
                el[0].innerText.includes("Passenger Details") &&
                el[0].innerText.includes("Contact Details") &&
                !el[0].innerText.includes("Please Wait...")
            ) {
                cy.task(
                    "log",
                    "TATKAL BOOKING NOW OPEN....STARTING FURTHER PROCESS"
                );
            } else if (
                !el[0].innerText.includes("Passenger Details") &&
                !el[0].innerText.includes("Contact Details") &&
                !el[0].innerText.includes("Please Wait...")
            ) {
                cy.get("body").then((el) => {
                    // iterating each block div of available trains starts here.....
                    cy.get(":nth-child(n) > .bull-back").each((div, index) => {
                        // confirming we click on same train no and seat class div
                        if (
                            div[0].innerText.includes(TRAIN_NO) &&
                            div[0].innerText.includes(TRAIN_COACH)
                        ) {
                            cy.wrap(div).contains(TRAIN_COACH).click();
                            cy.get(
                                `:nth-child(n) > .bull-back > app-train-avl-enq > :nth-child(1) > :nth-child(7) > :nth-child(1)`
                            )
                                .contains(formatDate(TRAVEL_DATE))
                                .click();
                            cy.get(
                                `:nth-child(n) > .bull-back > app-train-avl-enq > [style="padding-top: 10px; padding-bottom: 20px;"]`
                            ).then((elements) => {
                                elements.each((i, el) => {
                                  // Check if the div contains the ₹ symbol
                                  if (el.innerText.includes("₹")) {
                                    console.log(`Found ₹ in Div ${i + 1}:`, el.innerText); // Log the matching div
                                    // Click the "Book Now" button inside this div
                                    cy.wrap(el).contains("Book Now").click();
                                  }
                                });
                            });
                            // .contains("Book Now")
                            // .should('be.visible') // Ensure it's visible
                            // .and('not.be.disabled') // Ensure it's not disabled
                            // .click();
                            BOOK_UNTIL_TATKAL_OPENS(
                                div,
                                TRAIN_COACH,
                                TRAVEL_DATE,
                                TRAIN_NO,
                                TATKAL
                            );
                        }
                    });
                    // iterating each block div of available trains ends here.....
                });
                // body fetch block ends............
            } else {
                BOOK_UNTIL_TATKAL_OPENS(
                    div,
                    TRAIN_COACH,
                    TRAVEL_DATE,
                    TRAIN_NO,
                    TATKAL
                );
            }
        });
}
