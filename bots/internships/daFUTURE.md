# Future Plans .md
### This is a small file that I'm going to keep with the intent of throwing ideas in whenever they come by

## Commands
`/latest` - Top 5 most recent engineering internships, irrespective of field
`/ai` - Top 5 most recent Artificial Intelligence internships
`/ds` - Top 5 most recent Data Science internships
`/sendmeme` - DM the previously sent Mechanical Engineering internships JSON file
`/sendmeee` - DM the previously sent Electrical Engineering internships JSON file
`/sendmebm` - DM the previously sent Biomedical Engineering internships JSON file
`/sendmeai` - DM the previously sent Artificial Intelligence internships JSON file
`/sendmeds` - DM the previously sent Data Science internships JSON file

## Deployment
So after thinking about it, I need a production/test environment if I want to get PNMs to access this.
My plan:
1. Set up the git repo with a main, stage, and dev branch. Only the bot master can approve PRs between the stage and main branch, so that no failure code is uploaded.

2. Set up my secondary laptop, leave it sitting at home on linuxmint. Have it running the bot in the background, maybe set up a PM2 manager so that it can keep the bot running for me.

3. Write update script(s). The script will execute a `git fetch` and update the code on the remote laptop without me having to physically be there. Probably should have 2 more to pull the bot offline/online again.

4. Schedule the cron to run the update scripts at midnight every night. bot will go down for a bit, but then it can be remotely updated from anywhere.

This should fix the remote update/deployment problem. I do NOT want to containerize/deploy on kubernetes, but if that's what the people want so be it.

