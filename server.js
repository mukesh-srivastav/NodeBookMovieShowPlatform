require('./config/config');

const _ = require('lodash');
var express = require('express');
var bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
var url = require('url');

var {mongoose} = require('./db/mongoose');
var MovieTheatre = require('./models/Screen');

var Screen = MovieTheatre.Screen;
var Row = MovieTheatre.Row;
var Seat = MovieTheatre.Seat;


var app = express();
const port = process.env.PORT || 9090;

app.use(bodyParser.json());

/* API for posting Screen Information. 
Expected Request format : { "name":"inox", "seatInfo": { "A": { "numberOfSeats": 10, "aisleSeats": [0, 5 ,6, 9] }, "B": { "numberOfSeats": 15, "aisleSeats": [0, 5 ,6, 9] }, "D": { "numberOfSeats": 20, "aisleSeats": [0, 5 ,6, 9] } } }
Response : Screen layout with rowInfo and aisleSeats marked out.
*/
app.post('/screens', (req, res) => {

	var body = _.pick(req.body, ['name', 'seatInfo']);

	var screenName = body.name;
	var seatInfo = body.seatInfo;
	
	var rowNames = Object.keys(seatInfo);

	var screenRows = [];
	screenRows = rowNames.map( function(rowName) {
		var rowInfo = seatInfo[rowName];

		var row = new Row();
		row.noOfSeats = rowInfo.numberOfSeats;
		row.rowName = rowName;
		var aisleSeats = rowInfo.aisleSeats;

		var rowSeatInfo = [];
		var seatCount = 0;
		while (seatCount < row.noOfSeats) {
			var seat = new Seat({
				seatNumber : seatCount,
				available : true,
			});

			if(aisleSeats.indexOf(seat.seatNumber) != -1) {
				seat.isAisle = true;
			}
			rowSeatInfo.push(seat);
			seatCount++;
		}
		row.seatInfo = rowSeatInfo;
		
		return row;
	});

	var screen = new Screen({
		name : screenName,
		rowInfo : screenRows
	});

	// console.log(JSON.stringify(screen, undefined,2));
	screen.save().then((screen) => {
		res.status(200).send(screen);
	}, (err) => {
		res.status(400).send(err);
	});
});


/*
	API to book the tickets for given row and seatNumber. (Checks if all the given seats are available, it books the tickets)
Expected Request Format : { "seats": { "B": [1, 2], "C": [ 6, 7] } }
Response format : Status 200 with Success String or 400 with Error string.
*/
app.post('/screens/:screenName/reserve', (req, res) => {
	var body = _.pick(req.body, ['seats']);

	var screenName = req.params.screenName;
	var requestedSeats = body.seats;
	var rowNames = Object.keys(requestedSeats);

	Screen.findOne({name:screenName}).then((screen) => {

		if(!screen) {
			throw `Screen ${screenName} not found`;
		}

		var rowInfo = screen.rowInfo;
		var updatedScreen = [];
		var screenRowNames = []; 
		updatedScreen = rowInfo.map(function (row){
			var seatInfo = row.seatInfo;
			var requestedRowIndex = rowNames.indexOf(row.rowName);
			screenRowNames.push(row.rowName);
			if (requestedRowIndex != -1) {
				
				var requestRowSeats = requestedSeats[rowNames[requestedRowIndex]];
				var updatedRow = [];
				
				row.seatInfo = seatInfo.map(function (seat) {
						var requestedSeatIndex = requestRowSeats.indexOf(seat.seatNumber);
						
						if (requestedSeatIndex != -1) {
							if (seat.available !== true){
								throw `Seat ${row.rowName}${seat.seatNumber} is not available`;
							} else {
								console.log(row.rowName, seat.seatNumber);
								seat.available = false;
							}
						}
						return seat;
					});
			}
			return row;
			
		});

		var invalidRows = rowNames.filter(x => !screenRowNames.includes(x));

		if (invalidRows.length>0){
			throw `Invalid Rows exists in the request : ${invalidRows}`;
		}

		Screen.findOneAndUpdate({name:screenName}, {$set: {rowInfo:updatedScreen}}, {new: true}).then((screen) => {
			res.send({status: "Tickets booked"});
		}).catch((e) => {
			res.status(400).send();
		})
		
	}).catch((err) => {
		res.status(400).send(err);
	});
});


app.get('/screens/:screenName/seats', function (req, res) {
	var screenName = req.params.screenName;
	var reqParts = url.parse(req.url, true);
	
	if (reqParts.query.status == 'unreserved') {	
		Screen.findOne({
			name: screenName
		}).then(function (screen) {
			
			var rowDetails = screen.rowInfo;

			var available = [];
			available = rowDetails.map(function (row) {
				var seatInfo = row.seatInfo;
				var availableSeats = [];
				availableSeats = seatInfo.filter(seat => seat.available === true);
				availableSeats = availableSeats.map(function (seat) {
					return seat.seatNumber;
				});
				var availableRow = {};
				availableRow[row.rowName] = availableSeats;
				return availableRow;
			});

			res.send({seats:available});
				
		});		
	} else if (reqParts.query.numSeats && reqParts.query.choice) {
		var numSeats = reqParts.query.numSeats;
		var seatChoice = reqParts.query.choice.split('');

		var choiceRow =  seatChoice[0];
		var choiceCol = seatChoice[1];
		//console.log(choiceRow, choiceCol, numSeats);
		Screen.findOne({
			name: screenName
		}).then(function (screen) {
			var rowDetails = screen.rowInfo;

			var selectedRow = rowDetails.filter(row => row.rowName == choiceRow);

			if (selectedRow.noOfSeats > numSeats) {
				res.status(404).send(`${numSeats} are not available in selectedRow`);
			}
			var rowSeats = selectedRow.seatInfo;

			var sCount = choiceCol-numSeats + 1; // 4 -2 + 1 = 3
			var tSeat = choiceCol;
			var availableSeats = [];

			while(tSeat > sCount){
				if ( rowSeats[tSeat].available == true && rowSeats[tSeat].isAisle == false) {
				availableSeats.push(sCount);					
				} else break;
				sCount++;
			}
			var available = {};
			available.rowName = availableSeats;
			if (sCount == tSeat) {
				res.send({availableSeats : available});
			}
			var rAvail = []
			sCount = choiceCol + numSeats -1;
			while(tSeat < sCount){
				if ( rowSeats[tSeat].available == true && rowSeats[tSeat].isAisle == false) {
					rAvail.push(sCount);					
				} else break;
				tSeat++;
			}
			var ravailable = {};
			ravailable.rowName = rAvail;
			if (sCount == tSeat) {
				res.send({availableSeats : ravailable});
			} else {
				res.status(400).send('No optimal suggestions');
			}

		});

	}

});

app.listen(port, () => {
	console.log(`Started on port ${port}`);
});

module.exports = {app};
