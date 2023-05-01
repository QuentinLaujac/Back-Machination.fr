# Machination backend

Machination is a web application that allows users to play the Machination board game online.
This project is developed using Node.js.

## Architecture

The project architecture uses various AWS cloud components:
+ **AWS Cognito** for authentication with token management
+ **Dynamodb** for the database
+ **ApiGateway** for WebSocket management
+ **Lambda function** for web services (also WebSocket)
+ **Serverless** for infrastructure as a function

### Some explanations

All the AWS element configurations are located in the serverless.yml file, where you can view the environment variables, the DynamoDB table and its indexes, the web services and their restrictions, the WebSocket routes, etc.

## Getting Started

Before you can launch the project, you need to prepare your environment.

### Pré-requis

First, make sure you have installed Python on your machine (in my case, I have version 2.7.15). To find out, run this command in your console (CMD for Windows or Terminal for Linux):

```diff
$ python
+ Python 2.7.15 (v2.7.15:ca079a3ea3, Apr 30 2018, 16:30:26) [MSC v.1500 64 bit (AMD64)] on win32
```

If not, you can download it [here](https://www.python.org/downloads/release/python-2715/)


Make sure you have the correct version of Node.js installed; you need the latest stable version, which is currently 12.16. To check your version, run this command in your console:

```sh
$ node --version
```

If not, download the LTS version of Node.js [here](https://nodejs.org/en/download/)

Then use NVM to select version 10.15 of Node.js. To install NVM, go [here](https://github.com/creationix/nvm)

Once installed, run this command:

```sh
$ nvm install 12.16
```
or for the latest version

```sh
$ nvm install latest
```

Install the serverless framework:

```sh
$ npm install serverless -g
```

You also need Yarn (we use Yarn instead of npm) for this, go [here](https://classic.yarnpkg.com/fr/docs/install/#windows-stable)

Install the libraries from the root folder (where package.json is located):

```sh
$ yarn install
```

You now need to give credentials to Serverless to deploy to AWS. You need to get these keys from AWS in the IAM section

Install AWS CLI 2 via this [link](https://docs.aws.amazon.com/fr_fr/cli/latest/userguide/install-cliv2.html) and configure it with the keys generated earlier:

```sh
$ aws configure
AWS Access Key ID [None]: <your-key-here>
AWS Secret Access Key [None]: <your-secret-key-here>
Default region name [None]: eu-central-1
Default output format [None]: json
```

Then set these credentials as environment variables: 

For Unix:
```sh
$ export AWS_ACCESS_KEY_ID=<your-key-here>
$ export AWS_SECRET_ACCESS_KEY=<your-secret-key-here>
```

For Windows:
Set them as system environment variables (from the workstation).



## Usage

### To run the project locally

You will need to install Docker Desktop via this [link](https://www.docker.com/products/docker-desktop)
Then run this command:

```sh
$ docker run -p 9324:9324 softwaremill/elasticmq
```

To launch the project in debug mode through the Visual Studio Code IDE, use the launch.json file located in the .vscode folder. This solution enables setting breakpoints directly in the IDE.

Alternatively, using the serverless CLI:

```sh
$ sls offline start
```

To access AWS services locally, you can comment/uncomment the constants in the constant file located in the src folder.

## Deployment 

Make sure that the deployment environment matches your branch in the serverless.yml file.

```yml
 custom:
  defaultStage: dev
```

Finally, to deploy your application on AWS, use this command:

```sh
$ sls deploy
```

This command will install all dependencies and set up the environment (lambda function, DynamoDB, websocket, etc).

And that's it 😎

## Removal

To remove the deployed configuration from AWS, run this command:

```sh
$ sls remove
```

⚠️  This command will delete all the deployed infrastructure on AWS, including the content of tables. This command can be useful when the project's technical stack has completely changed and conflicts arise.

## Development rules

+ Use Visual Studio Code for your development.
+ Install the Editor config plugin [here](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)

## Authors

* **Quentin Laujac / Machination** - *Initial work* - [QuentinLaujac](https://github.com/QuentinLaujac)

## License

This project is licensed under the CC BY-NC-ND License - see the [LICENSE.md](LICENSE.md) file for details
