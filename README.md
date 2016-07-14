# OpsGenie & ConnectWise Integration

[OpsGenie](https://www.opsgenie.com) has [ConnectWise](http://www.connectwise.com/) integration that forwards your
OpsGenie alerts to ConnectWise by WebHook based alert actions (Create, Close, Delete, Add Note, etc).

You can capture related alert actions at any WEB backend. Here, we demonstrate how you can do it over
[AWS Lambda](https://aws.amazon.com/lambda/).

## Installing npm

a package manager for JavaScript [http://www.npmjs.com](http://www.npmjs.com)

npm is bundled with Node.js [http://nodejs.org/download](http://nodejs.org/download)

## Installing project dependencies

```sh
# install dependencies listed in package.json
$ cd opsgenie-connectwise-integration
$ npm install
```

## Configuring project

All required configuration options are listed under:

```sh
./index.js
```

Just enter required fields that surrounded by **<** **>** characters:

```sh
<ogApiKey>
<connectWiseCompanyId>
<connectWisePublicKey>
<connectWisePrivateKey>
<connectWiseSite>
<connectWiseTicketBoardName>
<connectWiseNewTicketStatusName>
<connectWiseClosedTicketStatusName>
<connectWiseTicketCompanyId>
<connectWiseTicketContactId>
```

## Deploying Lambda Function
* Select **index.js** and **node_modules** folder and compress as **ZIP** file
* Create Lambda Funtion on AWS Lambda Console
* Upload ZIP file from Code Tab on Lambda Console
