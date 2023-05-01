'use strict';

const ENUMS = {
    GAME_STATUS_CREATING: "CREATING",
    GAME_STATUS_IN_PROGRESS: "IN_PROGRESS",
    GAME_STATUS_ENDED: "ENDED",
    GAME_PRIVACY_PRIVATE: "PRIVATE",
    GAME_PRIVACY_PUBLIC: "PUBLIC",
    EVENT_PLAYER_JOIN: "EVENT_PLAYER_JOIN",
    EVENT_PLAYER_LEFT: "EVENT_PLAYER_LEFT",
    EVENT_REFRESH_GAME_DATA: "REFRESH_GAME_DATA",
    ERROR_REFRESH_GAME_DATA: "ERROR_REFRESH_GAME_DATA",
    ERROR_NOT_AUTHORIZED_TO_ASK_WITNESS: "ERROR_NOT_AUTHORIZED_TO_ASK_WITNESS",
    GAME_SEND_MESSAGE: "GAME_SEND_MESSAGE",
    GAME_RECEIVE_EVENT_MESSAGE: "GAME_RECEIVE_EVENT_MESSAGE",
    GAME_SENT_MSG: "GAME_MESSAGE_SENT",
    GAME_ACTION: "GAME_ACTION",
    GAME_INIT: "GAME_INIT",
    WRONG_CRIME_ELEMENT: "WRONG_CRIME_ELEMENT",
    PLAYER_FAILURE_CRIME_ELEMENT: "PLAYER_FAILURE_CRIME_ELEMENT",
    GAME_ROLE_ALLOCATION: "ROLE_ALLOCATION",
    SHOW_WITNESS: "SHOW_WITNESS",
    CANCEL_GAME_INIT: "CANCEL_GAME_INIT",
    PLAYER_JOIN_MESSAGE: "PLAYER_JOIN_MESSAGE",
    PLAYER_LEFT_MESSAGE: "PLAYER_LEFT_MESSAGE",
    LAUNCH_GAME: "LAUNCH_GAME",
    WELCOME_MESSAGE: "WELCOME_MESSAGE",
    SHOW_EVIDENCE: "SHOW_EVIDENCE",
    INTERROGATION_PHASE_1: "INTERROGATION_PHASE_1",
    QUESTION_WITNESS: "QUESTION_WITNESS",
    YOUR_TURN_INTERROGATION: "YOUR_TURN_INTERROGATION",
    YOUR_TURN_INTERROGATION_PHASE2: "YOUR_TURN_INTERROGATION_PHASE2",
    ROLE_PROPOSITION: "ROLE_PROPOSITION",
    SHOW_RESULTS: "SHOW_RESULTS",
    LAUNCH_NEXT_LEVEL: "LAUNCH_NEXT_LEVEL",
    YOUR_ROLE_PROPOSITION: "YOUR_ROLE_PROPOSITION",
    PLAYER_FIND_CRIME_ELEMENT: "PLAYER_FIND_CRIME_ELEMENT",
    VOTE_GUILTY: "VOTE_GUILTY",
    SHOW_RESULTS_FINAL: "SHOW_RESULTS_FINAL"

};

module.exports = ENUMS;