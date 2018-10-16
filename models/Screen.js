var mongoose = require('mongoose');

var seatStatusSchema = new mongoose.Schema({
	
	seatNumber: {
		type: Number,
		required: true,
	},

	isAisle: {
		type: Boolean,
		default: false
	},

	available: {
		type: Boolean,
		default:true
	}

});

var Seat = mongoose.model('SeatStatus', seatStatusSchema);

var RowInfoSchema = new mongoose.Schema({
	
	rowName: {
		type: String,
		required: true,
		minLength: 1,
		trim: true
	},

	noOfSeats : {
		type: Number,
		required: true,
	},

	seatInfo : [Seat.schema]
});

var Row = mongoose.model('RowInfo', RowInfoSchema);
	
var Screen = mongoose.model('Screen', {
	
	name: {
		type: String,
		required: true,
	},

	rowInfo : [Row.schema]
});

module.exports = {Screen, Row, Seat};