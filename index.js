
var request = require('request');

// CONFIG START
var opsgenie = {
    api: {
        baseUrl: 'https://api.opsgenie.com/v2/alerts/',
        baseReqOpts: {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Authorization': 'GenieKey ' + '<ogApiKey>' // Do not remove "GenieKey " part, replace only the "<ogApiKey>" part.
            }
        }
    }
};

var connectWise = {
    companyId: '<connectWiseCompanyId>', // Your company name.
    publicKey: '<connectWisePublicKey>',
    privateKey: '<connectWisePrivateKey>',
    site: '<connectWiseSite>', // ex: 'au.myconnectwise.net', 'eu.myconnectwise.net', 'na.myconnectwise.net', 'staging.connectwisedev.com'
    ticket: {
        summary: {
            maxLength: 100
        },
        board: {
            name: '<connectWiseTicketBoardName>' // ex: 'Professional Services'
        },
        status: {
            new: '<connectWiseNewTicketStatusName>', // ex: 'New (not responded)'
            closed: '<connectWiseClosedTicketStatusName>' // ex: 'Closed (resolved)'
        },
        company: {
            id: '<connectWiseTicketCompanyId>' // ex: '44'
        },
        contact: {
            id: '<connectWiseTicketContactId>' // ex: '178'
        },
        prefix: 'CW-'
    },
    api: {
        codebase: '<connectWiseCodeBase>', // ex: 'v2017_6'
        baseUrl: undefined, // To be set.
        baseReqOpts: {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Authorization': undefined // To be set.
            }
        },
        note: {
            internalAnalysisFlag: false,
            detailDescriptionFlag: true,
            resolutionFlag: false
        }
    }
};
// CONFIG END

connectWise.api.baseUrl = 'https://api-' + connectWise.site + '/' + connectWise.api.codebase + '/apis/3.0';

var connectWiseEncodedAuth = new Buffer(connectWise.companyId + '+' + connectWise.publicKey + ':' + connectWise.privateKey).toString('base64');
connectWise.api.baseReqOpts.headers['Authorization'] = 'Basic ' + connectWiseEncodedAuth;

function genericSuccessFunc(event, context) {
    console.log('Execution completed successfully.');
    context.succeed();
}

function createConnectWiseTicket(event, context) {
    var ticketSummaryWithPrefix = '[OpsGenie][' + event.alert.tinyId + '] ' + event.alert.message;
    var ticketSummaryTruncated = ticketSummaryWithPrefix.substr(0, connectWise.ticket.summary.maxLength);

    var reqOpts = Object.assign({
        url: connectWise.api.baseUrl + '/service/tickets',
        method: 'POST',
        json: {
            "summary": ticketSummaryTruncated,
            "board": {
                "name": connectWise.ticket.board.name
            },
            "status": {
                "name": connectWise.ticket.status.new
            },
            "company": {
                "id": connectWise.ticket.company.id
            },
            "contact": {
                "id": connectWise.ticket.contact.id
            },
            "initialDescription": "Issue created for OpsGenie Alert " + event.alert.alertId + " from Integration " + event.integrationId
        }
    }, connectWise.api.baseReqOpts);

    doApiCall(event, context, reqOpts, 'ConnectWise', 'creating ticket', 201, addConnectWiseTicketIdToOpsGenieAlertTags);
}

function addConnectWiseTicketIdToOpsGenieAlertTags(event, context, connectWiseResBody) {
    var reqOpts = Object.assign({
        headers: opsgenie.api.headers,
        url: opsgenie.api.baseUrl + event.alert.alertId +'/tags',
        method: 'POST',
        json: {
            'tags': [connectWise.ticket.prefix + connectWiseResBody.id]
        }
    }, opsgenie.api.baseReqOpts);

    doApiCall(event, context, reqOpts, 'OpsGenie', 'adding ticket id into alert tags', 202, genericSuccessFunc);
}

function addNoteToConnectWiseTicket(event, context) {
    var connectWiseTicketId = extractConnectWiseTicketIdFromAlertTag(event, context);
    if (!connectWiseTicketId) {
        return;
    }

    var reqOpts = Object.assign({
        url: connectWise.api.baseUrl + '/service/tickets/' + connectWiseTicketId + '/notes',
        method: 'POST',
        json: {
            "text": event.alert.note,
            "internalAnalysisFlag": connectWise.api.note.internalAnalysisFlag,
            "detailDescriptionFlag": connectWise.api.note.detailDescriptionFlag,
            "resolutionFlag": connectWise.api.note.resolutionFlag
        }
    }, connectWise.api.baseReqOpts);

    doApiCall(event, context, reqOpts, 'ConnectWise', 'adding comment to ticket', 201, genericSuccessFunc);
}

function closeConnectWiseTicket(event, context) {
    var connectWiseTicketId = extractConnectWiseTicketIdFromAlertTag(event, context);
    if (!connectWiseTicketId) {
        return;
    }

    var reqOpts = Object.assign({
        url: connectWise.api.baseUrl + '/service/tickets/' + connectWiseTicketId,
        method: 'GET'
    }, connectWise.api.baseReqOpts);

    doApiCall(event, context, reqOpts, 'ConnectWise', 'retrieving ticket', 200, function (event, context, connectWiseTicket) {
        if (!connectWiseTicket.board) {
            return;
        }
        var connectWiseBoardId = connectWiseTicket.board.id;

        reqOpts = Object.assign({
            url: connectWise.api.baseUrl + '/service/boards/' + connectWiseBoardId + '/statuses',
            method: 'GET',
            qs: {
                conditions: 'name = "' + connectWise.ticket.status.closed + '"'
            }
        }, connectWise.api.baseReqOpts);

        doApiCall(event, context, reqOpts, 'ConnectWise', 'retrieving close status', 200, function (event, context, connectWiseStatuses) {
            if (!connectWiseStatuses || connectWiseStatuses.length === 0) {
                context.done(new Error('Cannot determine ConnectWise ticket close status with name: ' + connectWise.ticket.status.closed));
                return;
            }
            var connectWiseCloseStatus = connectWiseStatuses[0];

            reqOpts = Object.assign({
                url: connectWise.api.baseUrl + '/service/tickets/' + connectWiseTicketId,
                method: 'PATCH',
                json: [
                    {
                        "op": "replace",
                        "path": "status/id",
                        "value": connectWiseCloseStatus.id
                    }
                ]
            }, connectWise.api.baseReqOpts);

            doApiCall(event, context, reqOpts, 'ConnectWise', 'closing ticket', 200, genericSuccessFunc);
        });
    });
}

function doApiCall(event, context, reqOpts, service, happening, successCode, onSuccess) {
    console.log(service + ' request in progress: ' + JSON.stringify(reqOpts));

    request(reqOpts, function (error, response, body) {
        if (error) {
            context.done(new Error(service + ' request error: ' + error));
            return;
        }

        console.log(service + ' response status: ' + response.statusCode);
        console.log(service + ' response body: ' + JSON.stringify(body));

        if (response.statusCode !== successCode) {
            context.done(new Error(service + ' ' + happening + ' failed.'));
            return;
        }

        try {
            onSuccess(event, context, JSON.parse(body));
        } catch (e) {
            onSuccess(event, context, JSON.parse(JSON.stringify(body)));
        }
    });
}

function extractConnectWiseTicketIdFromAlertTag(event, context) {
    var tags = event.alert.tags;
    var connectWiseTicketPrefix = connectWise.ticket.prefix;

    var tagsLength = tags.length;
    var tag;
    for (var i = 0; i < tagsLength; i++) {
        tag = tags[i];
        if (tag.indexOf(connectWiseTicketPrefix) === 0) {
            return tag.substring(connectWiseTicketPrefix.length);
        }
    }

    context.done(new Error('Cannot determine associated ConnectWise ticket. Alert data lacks ConnectWise ticket key tag.'));
    return null;
}

exports.handler = function (event, context) {
    console.log('Received event: ', event);

    if (event.action === 'Create') {
        if (event.alert.source == "ConnectWise") {
            console.log("Ignoring action 'Create' since the alert source is ConnectWise.");
            context.succeed();
        } else {
            createConnectWiseTicket(event, context);
        }
    } else if (event.action === 'AddNote') {
        addNoteToConnectWiseTicket(event, context);
    } else if (event.action === 'Close' || event.action === 'Delete') {
        closeConnectWiseTicket(event, context);
    } else {
        context.done(new Error('Action type "' + event.action + '" not supported.'));
    }
};
