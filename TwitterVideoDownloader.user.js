// ==UserScript==
// @name         Twitter Video Downloader
// @version      1.2
// @description  Adds option to download twitter videos in the right click menu
// @author       DaRealSh0T
// @namespace    https://github.com/DaRealSh0T/Twitter-Video-Downloader
// @updateURL    https://github.com/DaRealSh0T/Twitter-Video-Downloader/raw/main/TwitterVideoDownloader.user.js
// @match        https://twitter.com/*
// @match        https://x.com/*
// @grant        unsafeWindow
// @sandbox      JavaScript
// ==/UserScript==

const toWatch = [];

async function downloadVideo(videoUrl) {
	let req = await fetch(videoUrl);
	let blob = await req.blob();

	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.setAttribute('download', videoUrl.split('/').at(-1).split('?')[0]);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

const buttons = [
	['Open in New Tab', downloadURL => window.open(downloadURL, '_blank')],
	['Download', downloadURL => downloadVideo(downloadURL)],
];

let observer = new MutationObserver(mutationList => {
	for (const mutation of mutationList) {
		if (mutation.type == 'childList') {
			if (mutation.addedNodes.length) {
				for (const addedNode of mutation.addedNodes) {
					if (
						addedNode.childElementCount != 1 ||
						addedNode.firstChild.role != 'menuitem'
					)
						continue;
					let videoElm =
						addedNode.parentElement?.parentElement?.parentElement?.getElementsByTagName?.(
							'video'
						)?.[0];
					if (videoElm && videoElm.poster) {
						let added = false;
						for (const [poster, downloadURL] of toWatch) {
							if (videoElm.poster == poster) {
								added = true;
								for (const [text, func] of buttons) {
									const newMenuItem =
										addedNode.firstChild.cloneNode(true);
									newMenuItem.firstChild.firstChild.firstChild.innerText =
										text;
									newMenuItem.onclick = () =>
										func(downloadURL);
									addedNode.appendChild(newMenuItem);
								}
							}
						}
						if (!added && videoElm.src?.endsWith?.('.mp4')) {
							for (const [text, func] of buttons) {
								const newMenuItem =
									addedNode.firstChild.cloneNode(true);
								newMenuItem.firstChild.firstChild.firstChild.innerText =
									text;
								newMenuItem.onclick = () => func(downloadURL);
								addedNode.appendChild(newMenuItem);
							}
						}
					}
				}
			}
		}
	}
});

observer.observe(document.body, {
	attributes: false,
	childList: true,
	subtree: true,
});

function parseTweetLegacy(legacy) {
	for (const mediaEntity of legacy?.extended_entities?.media ?? []) {
		if (mediaEntity?.type == 'video') {
			const highestBitrate = mediaEntity.video_info.variants.sort(
				(a, b) => (b.bitrate || 0) - (a.bitrate || 0)
			)[0];
			toWatch.push([mediaEntity.media_url_https, highestBitrate.url]);
		}
	}
}

function parseTimelineAddEntries(timelineAddEntries) {
	for (const entry of timelineAddEntries.entries) {
		let content = entry.content;
		if (content.entryType == 'TimelineTimelineItem') {
			if (content?.itemContent?.tweet_results?.result?.legacy) {
				parseTweetLegacy(
					content.itemContent.tweet_results.result.legacy
				);
			} else if (content?.itemContent?.tweet_results?.result?.tweet) {
				parseTweetLegacy(
					content.itemContent.tweet_results.result.tweet.legacy
				);
			}
			const quotedTweet =
				content?.itemContent?.tweet_results?.result
					?.quoted_status_result?.result;
			if (quotedTweet?.legacy) {
				parseTweetLegacy(quotedTweet.legacy);
			} else if (quotedTweet?.tweet) {
				parseTweetLegacy(quotedTweet.tweet.legacy);
			}
		} else if (content.entryType == 'TimelineTimelineModule') {
			for (const item of content.items) {
				const tweetResults =
					item?.item?.itemContent?.tweet_results?.result;
				if (tweetResults?.legacy) {
					parseTweetLegacy(tweetResults.legacy);
				} else if (tweetResults?.tweet?.legacy) {
					parseTweetLegacy(tweetResults.tweet.legacy);
				}
				if (tweetResults?.quoted_status_result) {
					const quotedTweet =
						tweetResults?.quoted_status_result?.result;
					if (quotedTweet?.legacy) {
						parseTweetLegacy(quotedTweet.legacy);
					} else if (quotedTweet?.tweet?.legacy) {
						parseTweetLegacy(quotedTweet.tweet.legacy);
					}
				}
			}
		}
	}
}

function parseInstructions(instructions) {
	const timelineAddEntries = instructions.find(
		a => a?.type == 'TimelineAddEntries'
	);
	if (timelineAddEntries) {
		parseTimelineAddEntries(timelineAddEntries);
	}
}

const pGetAllResponseHeaders = XMLHttpRequest.prototype.getAllResponseHeaders;
XMLHttpRequest.prototype.getAllResponseHeaders = function () {
	try {
		const pathname = new URL(this.responseURL).pathname;
		if (this.readyState == this.DONE) {
			let res = JSON.parse(this.responseText);
			if (pathname.endsWith('TweetDetail')) {
				res = res?.data?.threaded_conversation_with_injections_v2;
				if (res?.instructions) {
					parseInstructions(res.instructions);
				}
			} else if (pathname.endsWith('UserTweets')) {
				res = res?.data?.user?.result?.timeline_v2?.timeline;
				if (res?.instructions) {
					parseInstructions(res.instructions);
				}
			} else if (pathname.endsWith('HomeTimeline')) {
				res = res?.data?.home?.home_timeline_urt;
				if (res?.instructions) {
					parseInstructions(res.instructions);
				}
			}
		}
	} catch (e) {}
	return pGetAllResponseHeaders.apply(this, arguments);
};

unsafeWindow.XMLHttpRequest.prototype.getAllResponseHeaders = cloneInto(
	XMLHttpRequest.prototype.getAllResponseHeaders,
	unsafeWindow,
	{
		cloneFunctions: true,
	}
);
