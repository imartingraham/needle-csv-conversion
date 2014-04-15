var fs = require('fs'),
		csv = require('csv'),
		moment = require('moment'),
		m = moment(),
		newData = [],
		tempData = {},
		unconvertedFolder = "./unconverted/",
		convertedFolder = "./converted/",
		newColumns = ["Date", "Day of Week", "Time", "Header Qualified Chats", "Product Qualified Chats", "Proactive Qualified Chats"];


// set date language so we get the correct month and day names
moment.lang('en');

function backFillPrevious(currentDate, previousDate){
	var backFillDates = [];
	if(currentDate.dayOfYear() != previousDate.dayOfYear()){
		var i = 0,
				currHours = currentDate.hour();
		for(i = currHours; i  > 0; i--){
			var prevHour = moment(currentDate);
			prevHour.subtract('h', i);
			backFillDates.push({
				"Date": prevHour.format('MM/DD/YYYY'),
				"Day of Week": prevHour.format('dddd'),
				"Time":  prevHour.format("h:mma"),
				"Header Qualified Chats": 0,
				"Product Qualified Chats": 0,
				"Proactive Qualified Chats": 0
			});
		}
	}
	return backFillDates;

}

function backFillNext(currentDate, nextDate){
	var backFillDates = [],
			hoursDiff = 0;
	// first let's compare days. we'll just backfill for the current day

	if(currentDate.dayOfYear() == nextDate.dayOfYear()){
		hoursDiff = nextDate.hours() - currentDate.hours();
	}else{
		// if it's the next day, let's start from midnight
		hoursDiff = 24 - currentDate.hour();
	}
	if(hoursDiff > 0){
		var i = 0;
		// subtract on hour so we don't get duplicate hours
		for(i = 0; i < hoursDiff - 1; i++){
			// clone the date rather then add an hour so we
			// can use the currentDate object for previous hours
			var nextHour = moment(currentDate);
			// add an hour 
			nextHour.add('h', i + 1);
			backFillDates.push({
				"Date": nextHour.format('MM/DD/YYYY'),
				"Day of Week": nextHour.format('dddd'),
				"Time":  nextHour.format("h:mma"),
				"Header Qualified Chats": 0,
				"Product Qualified Chats": 0,
				"Proactive Qualified Chats": 0
			});
		}
	}
	return backFillDates;

}

function setCurrentDateInfo(row){
	var tempDate = row['Date'].replace('a.m.', 'am').replace('p.m.', 'pm'),
			date = moment(tempDate, 'MMMM DD, YYYY ha');
	if(date.isValid()){

		if(typeof tempData[date.toString()] == 'undefined'){
			tempData[date.toString()] = {
				"Date": date.format('MM/DD/YYYY'),
				"Day of Week": date.format('dddd'),
				"Time":  date.format("h:mma")
			};
		}
		// we're uppercasing the first character of the campaign and adding qualified chats on the end
		var campaignName = row['Campaign'].split('-')[0]
		var qualifiedChatName = campaignName.charAt(0).toUpperCase() + campaignName.slice(1) + " Qualified Chats";
		tempData[date.toString()][qualifiedChatName] = row["Qualified Chats"];
	}
}

function writeData(file){
	var convertedFileName = 'converted-'+file.split('/').slice(-1),
			dataKeys = Object.keys(tempData),
			keysLength = dataKeys.length
			i = 0;

	for(i = 0; i < keysLength; i++){

		var data = tempData[dataKeys[i]];
		// set defaults for qualified chats if we don't have them
		if(typeof data['Header Qualified Chats'] == 'undefined'){
			data['Header Qualified Chats'] = 0;
		}
		if(typeof data['Product Qualified Chats'] == 'undefined'){
			data['Product Qualified Chats'] = 0;
		}
		if(typeof data['Procative Qualified Chats'] == 'undefined'){
			data['Proactive Qualified Chats'] = 0;
		}

		// let's back fill the hours with null values
		var currRowDate = moment(dataKeys[i]),
				nextRowDate = moment(dataKeys[i+1]),
				prevRowDate = moment(dataKeys[i-1]);


		// backfill the hours from the start of the current date to the current row

		newData.push.apply(newData, backFillPrevious(currRowDate, prevRowDate));
		// push the current day data so we keep everything chronological
		newData.push(data);
		// backfill the difference between the current hour and the next hour
		newData.push.apply(newData, backFillNext(currRowDate, nextRowDate));

	}

	// save the file
	csv().from(newData)
			.to(fs.createWriteStream(convertedFolder+convertedFileName), {header: true, columns: newColumns})
			.on('end', function(){ 
				console.log('all done');
			});
}

// we want to loop through all the files in the unconverted directory
fs.readdir(unconvertedFolder, function(err, files){
	// make sure we're only dealing with csv files
	files = files.filter(function(file){ return file.substr(-4) == '.csv'; });

	files.forEach(function(file){
		csv().from.path(unconvertedFolder+file, {columns: true})
		.transform(setCurrentDateInfo)
			// binding the file name to the function to create our new file
			.on('end', writeData.bind(this, file));

	});
});
