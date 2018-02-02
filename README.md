# Cisco Meraki CMX API demo app + VIP highlighting

This application is a small addition to this app: https://github.com/meraki/scanning-api-app.

This version has a static list of VIP mac's and will highlight them in blue as opposed to the usual green.  The color should probably be changed if you also intend to process BLE data.

## Table of contents

- [Installation and requirements](#installation-and-requirements)
- [Running the app](#running-the-app)
- [Sample output code](#sample-output-code)
- [Copyright and license](#copyright-and-license)

## DISCLAIMERS:

1. This code is for sample purposes only. Before running in production,
   you should probably add SSL/TLS support by running this server behind a
   TLS-capable reverse proxy like nginx. 

2. You should also test that your server is capable of handling the rate
   of events that will be generated by your networks. A good rule of thumb is
   that your server should be able to process all your network's nodes once per
   minute. So if you have 100 nodes, your server should respond to each request
   within 600 ms. For more than 100 nodes, you will probably need a multithreaded
   web app.

3. This version of the scanning-api-app runs a web server and also Resque, a background
   message queuing and processing system, as separate dynos (virtual machine) in Heroku (web and worker). 
   Heroku allows 1 free web and worker dynos respectively. You can increase the number of these to 
   scale your application
   
## Installation and requirements

### Installation

#### Heroku

1. Set up Heroku
- Download and install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli#download-and-install)
- Create your Heroku account, then set your heroku login credentials using ‘heroku login’
2. Clone project
- Create a new directory for this project.
- Clone the repo into this directory by running `git clone git@github.com:meraki/scanning-api-app.git` (this will clone the project into the subdirectory `scanning-api-app`).
- Alternatively, [download the ZIP file](https://github.com/meraki/cmx-api-app/archive/master.zip) and unzip it into your project directory.
3. App setup
- In the new directory, run ```heroku create <app_name>``` - this will create your app on Heroku for the url `app_name.herokuapp.com`. You can also leave `<app_name>` empty to let Heroku pick a random app name for you.
- Set the environment variables using the following command
  
  `heroku config:set VALIDATOR=<validator> SECRET=<secret>`
  
  For more information regarding the VALIDATOR and SECRET, check out [Running the app](#running-the-app) below.
- Create a Redis instance using the following command:
	
	`heroku addons:create heroku-redis:hobby-dev`
	
	This will create a Heroku Redis instance and set it’s URL in the environment variable `REDIS_URL`, which our app requires. ‘hobby-dev’ is a free Redis instance. To upgrade, read more at:
	
	https://devcenter.heroku.com/articles/heroku-redis#migrating-to-heroku-redis
	
	If you don’t want to use Heroku Redis, you could set up your own Redis instance and set its url as the value of the `REDIS_URL` env variable (similar to setting VALIDATOR SECRET)
- Similarly, create the PostgreSQL Database using the command:
	
	`heroku addons:create heroku-postgresql:hobby-dev`
	
	This will create the Postgresql database and set the environment variable `DATABASE_URL`, which the app requires.
- Run ```heroku ps:scale web=1 worker=1```.
	This command tells Heroku that it should add a worker to your app. Heroku will run the processes using the command mentioned in the Procfile.
4. Launching the app
- After you have set the above variables, run `git push heroku master` to push your repository to Heroku and have it automatically run your web application. The application will now be available at `app_name.heroku.com`

#### Non-Heroku
- This app can be directly pushed to Heroku. To run locally, you can use the gem [foreman](https://github.com/ddollar/foreman). 
	- Ensure you've got `ruby 1.9.3` installed, and then run `bundle install` from the app's directory.
	- Set the environment variables as shown above(after you've set up your databases). 
	- Additionally, set the `PORT` environmental variable to the port you want the app to listen on. (Eg: 4567)
	- Run `gem install foreman` and then run the app with `foreman start` to run the commands in the Procfile and start your server.

### Software requirements:

- When running without Heroku, ensure you have Ruby 1.9.3 installed. If you don’t, consider using [RVM](https://rvm.io) to install and manage your Ruby versions.

#### Gems:
- Refer to the Gemfile for the required gems
- Run `bundle install` to install the required gems when you're running the app yourself.
- It is generally a bad thing to change the contents of the Gemfile

### Network infrastructure requirements:

- The app requires using one or more [Cisco Meraki MR wireless access points](https://meraki.cisco.com/products/wireless) (APs).
- A valid Enterprise license is required for each Meraki AP.
- Note: this app does not work with other Cisco APs or non-Cisco APs.

## Running the app
Let’s say you plan to run this app on a server you control called pushapi.myserver.com on port 4567.

1. Go to the Cisco Meraki dashboard and configure the CMX Location Push API (find it under Organization > Settings) with the url `http://pushapi.myserver.com:4567/events`
2. Choose a secret and enter it into the dashboard.
3. Make note of the validation code that dashboard provides.
4. Install the application as shown above.
6. Click the “Validate server” button in CMX Location Push API configuration in the dashboard. Meraki cloud servers will perform a GET to your server, and if you set up the server correctly, you will see `Validated http://pushapi.myserver.com:4567/events` in the dashboard. You will also see a log message like this:

	```[26/Mar/2014 11:52:09] "GET /events HTTP/1.1" 200 6 0.0024```

	If you aren't using Heroku and you do not see such a log message, check your firewall and make sure
you’re allowing connections to port 4567. You can confirm that the server
is receiving connections on the port using

  ```telnet pushapi.myserver.com 4567```
  
  For Heroku logs, run `heroku logs -t` from your app directory.

6. Once the Meraki cloud has confirmed that the URL you provided returns the expected
validation code, it will begin posting events to your URL. For example, when
a client probes one of your access points, you’ll see a log message like
this:

  ```[2014-03-26T11:51:57.920806 #25266]  INFO -- : AP 11:22:33:44:55:66 on ["5th Floor"]: {"ipv4"=>"123.45.67.89", "location"=>{"lat"=>37.77050089978862, "lng"=>-122.38686903158863,"unc"=>11.39537928078731}, "seenTime"=>"2014-05-15T15:48:14Z", "ssid"=>"Cisco WiFi","os"=>"Linux", "clientMac"=>"aa:bb:cc:dd:ee:ff","seenEpoch"=>1400168894, "rssi"=>16, "ipv6"=>nil, "manufacturer"=>"Meraki"}```

7. After your first client pushes start arriving (this may take a minute or two),
you can get a JSON blob describing the last client probe (where {mac} is the client mac address): `pushapi.myserver.com:4567/clients/{mac}`

8. You can also view the sample frontend at: `http://pushapi.myserver.com:4567/`. Try connecting your mobile device to your network, and entering your mobile device‘s WiFi MAC in the frontend.

### Scaling your app

If you want more control over the efficiency of your app on your machine(or in the Heroku dynos):
- Each Heroku web dyno has a number of unicorn process (instances of your web application). Change the value of `worker_processes` in `unicorn.rb` to increase this. 
- To increase the number of background processes running per Heroku worker dyno, change the value of `COUNT=` in the Procfile.
WARNING: Increasing these to a number too high will lead to your system running out of memory.

## Sample output code

The JSON blob sent by Meraki servers to your app is formatted as follows:

```
{
  "apMac":"00:18:0a:79:08:60",
  "apFloors":["500 TF 4th"],
  "observations":[{
    "clientMac":"00:11:22:33:44:55:66",
    "probeEpoch":1388577600,
    "probeTime":"2014-01-01T12:00:00Z",
    "rssi":23,
    "ssid":"SSID 1",
    "manufacturer":"Meraki",
    "os":"Linux",
    "location":{
      "lat":37.77057805947924
      "lng":-122.38765965945927,
      "unc":15.13174349529074,
    },...]
  }
}
```

A specific client device’s details can be retrieved, for example:

`http://pushapi.myserver.com:4567/clients/34:23:ba:a6:75:70` 

may return

```
{
  "id":65,
  "mac":"34:23:ba:a6:75:70",
  "seenAt":"Fri Apr 18 00:01:41.479 UTC 2014",
  "lat":37.77059042088197,"lng":-122.38703445525945
}
```

## Copyright and license

Code and documentation copyright 2013-2014 Cisco Systems, Inc. Code released under [the MIT license](LICENSE). Documentation released under [Creative Commons](DOCS-LICENSE).
