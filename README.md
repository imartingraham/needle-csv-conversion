# Needle CSV Conversion
This script converts the Needle CSV to a format that fills in missing dates and puts all the campain metric info onto the same date.

## Dependencies
- nodejs
- node modules: (these are included in the node_modules directory) 
	- csv
	- moment


##Instructions
This script needs to be run in the command line.

1. Put the files that need to be converted into the folder called `unconverted`
2. Open up your command line program (Terminal on mac)
3. cd into the `needle-csv-conversion` directory
4. Run this command `node script`
5. When the script has finished converting a file the command line will output  "{fileName} has been converted"
6. Check the `converted` directory for your converted files
 
 
### Advanced
By default, the script only gets the `Qualified Chats` metric from the Needle CSV file.  You can pass an argument when you run the script like this:

`node script metrics="Qualified Chats,Ghost Chats"`

The argument's values must be a comma separated list inside quotes.

The metrics argument will look in the uncoverted csv for columns matching the ones passed and add those to the converted csv for each campaign.
