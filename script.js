var fs = require('fs'),
		csv = require('csv'),
		moment = require('moment'),
		m = moment(),
		newData = [],
		tempData = {},
		unconvertedFolder = "./unconverted/",
		convertedFolder = "./converted/",
		newColumns = ["Date", "Day of Week", "Time"],
		metricsNeeded = ['Qualified Chats'],
		newMetricColumns = [],
		args = {};
		
process.argv.forEach(function(item){
	var argSet = item.trim().split('=');
	args[argSet[0]] = argSet[1]
});

// set the metricsNeeded to allow us to
// add new metrics as needed
if(typeof args['metrics'] != 'undefined'){
	metricsNeeded = args['metrics'].split(',').map(function(item){ return item.trim()});
}
// node  runs into issues using the ~ as a short cut, so we're going to replace it
// with the full user path
if(typeof args['convertedDir'] != 'undefined'){
	convertedFolder = args['convertedDir'].trim().replace('~', '/Users/'+process.env.USER);
}

if(typeof args['unconvertedDir'] != 'undefined'){
	unconvertedFolder = args['unconvertedDir'].trim().replace('~', '/Users/'+process.env.USER);
}

// set date language so we get the correct month and day names
moment.lang('en');

function backFillPrevious(currentDate, previousDate){
	var backFillDates = [],
			data;
	if(currentDate.dayOfYear() != previousDate.dayOfYear()){
		var i = 0,
				currHours = currentDate.hour();
		for(i = currHours; i  > 0; i--){
			var prevHour = moment(currentDate);
			prevHour.subtract('h', i);

			data = {
				"Date": prevHour.format('MM/DD/YYYY'),
				"Day of Week": prevHour.format('dddd'),
				"Time":  prevHour.format("h:mma")
			}
			// set zero values for each metric
			newMetricColumns.forEach(function(column){
				data[column] = 0;
			});
			
			backFillDates.push(data);
		}
	}
	return backFillDates;

}

function backFillNext(currentDate, nextDate){
	var backFillDates = [],
			data = {},
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
			data = {
				"Date": nextHour.format('MM/DD/YYYY'),
				"Day of Week": nextHour.format('dddd'),
				"Time":  nextHour.format("h:mma")
			}
			// set zero values for each metric
			newMetricColumns.forEach(function(column){
				data[column] = 0;
			});

			backFillDates.push(data);
		}
	}
	return backFillDates;

}

function setCurrentDateInfo(row){
	var tempDate = row['Date'].replace('a.m.', 'am').replace('p.m.', 'pm'),
			date = moment(tempDate, 'MMMM DD, YYYY ha');
	// we only want to run the conversion if the file has a "Campaign" columns
	if(date.isValid() && typeof row['Campaign'] != 'undefined'){

		if(typeof tempData[date.toString()] == 'undefined'){
			tempData[date.toString()] = {
				"Date": date.format('MM/DD/YYYY'),
				"Day of Week": date.format('dddd'),
				"Time":  date.format("h:mma")
			};
		}
		// we're uppercasing the first character of the campaign and adding qualified chats on the end
		var campaignName = row['Campaign'].split('-')[0]
		metricsNeeded.forEach(function(item){
			var qualifiedChatName = campaignName.charAt(0).toUpperCase() + campaignName.slice(1) + " "+ item;
			tempData[date.toString()][qualifiedChatName] = row[item];
			// add the column if it not in the initial array
			// this will help with new campaigns that show up later
			if(newColumns.indexOf(qualifiedChatName) == -1){
				newColumns.push(qualifiedChatName);
			}
			if(newMetricColumns.indexOf(qualifiedChatName) == -1){
				newMetricColumns.push(qualifiedChatName);
			}
		});
	}
}

function writeData(file){
	var convertedFileName = 'converted-'+file.split('/').slice(-1),
			dataKeys = Object.keys(tempData),
			keysLength = dataKeys.length
			i = 0;

	for(i = 0; i < keysLength; i++){

		var data = tempData[dataKeys[i]];

		// fill in empty values for unset campaigns 
		newMetricColumns.forEach(function(column){
			if(typeof data[column] == 'undefined'){
				data[column] = 0;
			}
		});

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
				console.log( convertedFileName.replace('converted-', '') +' has been converted');
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
