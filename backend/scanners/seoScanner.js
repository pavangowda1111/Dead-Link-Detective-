
function getAttribute(tag, attribute) {
    const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const match = tag.match(
        new RegExp(`${escaped}\\s*=\\s*["']([^"']*)["']`, "i")
    );

    return match ? match[1].trim() : null;
}

function scanSEO(page) {
    const html = page.html || "";

    const titleMatch = html.match(
        /<title[^>]*>([\s\S]*?)<\/title>/i
    );

    const descriptionMatch = html.match(
        /<meta[^>]+name=["']description["'][^>]*>/i
    );

    const title = titleMatch
        ? titleMatch[1].replace(/\s+/g, " ").trim()
        : null;

    const description = descriptionMatch
        ? getAttribute(descriptionMatch[0], "content")
        : null;

    const canonicalMatch = html.match(
        /<link[^>]+rel=["']canonical["'][^>]*>/i
    );

    const canonical = canonicalMatch
        ? getAttribute(canonicalMatch[0], "href")
        : null;

    const headings = html.match(/<h1\b[^>]*>/gi) || [];
    const images = html.match(/<img\b[^>]*>/gi) || [];

    const imagesWithoutAlt = images.filter(image => {
        const alt = getAttribute(image, "alt");
        return alt === null || alt === "";
    });

    const links = html.match(/<a\b[^>]+href=["'][^"']+["'][^>]*>/gi) || [];

    const robotsMatch = html.match(
        /<meta[^>]+name=["']robots["'][^>]*>/i
    );

    const robots = robotsMatch
        ? getAttribute(robotsMatch[0], "content")
        : null;

    const issues = [];

    if (!title) {
        issues.push("Missing page title.");
    } else if (title.length < 10 || title.length > 60) {
        issues.push("Page title length is outside the commonly recommended 10–60 character range.");
    }

    if (!description) {
        issues.push("Missing meta description.");
    } else if (description.length < 50 || description.length > 160) {
        issues.push("Meta description length is outside the commonly recommended 50–160 character range.");
    }

    if (headings.length === 0) {
        issues.push("No H1 heading detected.");
    } else if (headings.length > 1) {
        issues.push("Multiple H1 headings detected; review the page heading structure.");
    }

    if (imagesWithoutAlt.length > 0) {
        issues.push(`${imagesWithoutAlt.length} image(s) have missing or empty alt attributes.`);
    }

    if (!canonical) {
        issues.push("No canonical link detected.");
    }

    return {
        title,
        titleLength: title ? title.length : 0,
        description,
        descriptionLength: description ? description.length : 0,
        canonical,
        h1Count: headings.length,
        imageCount: images.length,
        imagesWithoutAlt: imagesWithoutAlt.length,
        linkCount: links.length,
        robotsMeta: robots,
        issuesCount: issues.length,
        issues
    };
}

module.exports = { scanSEO };
