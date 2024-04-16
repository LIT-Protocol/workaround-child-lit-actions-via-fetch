# Calling child lit actions using fetch

Right now, child lit actions are broken on Manzano and Habanero. An update is coming in a few weeks to fix them, but in the meantime, you can use `fetch` within a lit action to accomplish the same thing.

To be clear, this is a hack, but it works. The idea is that anytime you would call a child lit action, you could use fetch instead, and you can get the same result. The difference is that there are a few things you have to handle manually.

1. You have to pass the authSig through as a jsParam. This is needed so that when we do the fetch call, we can send this with it, and auth with the nodes.
2. You have to set the child correlation ID manually. It's just a random string. There's an example of this in the code

# Running

First, use `npm install` to install the dependencies.

Then, use `npm run start` to run the code.
