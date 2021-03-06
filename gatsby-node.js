const path = require('path');
const slash = require('slash');
const {kebabCase, uniq, get, compact, times} = require('lodash');

// Don't forget to update hard code values into:
// - `templates/blog-page.tsx:23`
// - `pages/blog.tsx:26`
// - `pages/blog.tsx:121`
const POSTS_PER_PAGE = 10;
const cleanArray = arr => compact(uniq(arr));

// Create slugs for files.
// Slug will used for blog page path.
exports.onNodeCreate = ({node, boundActionCreators, getNode}) => {
  const {updateNode} = boundActionCreators;
  let slug;
  switch (node.type) {
    case `MarkdownRemark`:
      const fileNode = getNode(node.parent);
      const [basePath, name] = fileNode.relativePath.split('/');
      slug = `/${basePath}/${name}/`;
      break;
  }
  if (slug) {
    updateNode(Object.assign({}, node, {slug}));
  }
};

// Implement the Gatsby API `createPages`.
// This is called after the Gatsby bootstrap is finished
// so you have access to any information necessary to
// programatically create pages.
exports.createPages = ({graphql, boundActionCreators}) => {
  const {upsertPage} = boundActionCreators;

  return new Promise((resolve, reject) => {
    const templates = ['blogPost', 'tagsPage', 'blogPage']
      .reduce((mem, templateName) => {
        return Object.assign({}, mem,
        {[templateName]: path.resolve(`src/templates/${kebabCase(templateName)}.tsx`)});
      }, {});

    graphql(
      `
      {
        posts: allMarkdownRemark {
          edges {
            node {
              slug
              frontmatter {
                tags
              }
            }
          }
        }
      }
    `
    ).then(result => {
      if (result.errors) {
        return reject(result.errors);
      }
      const posts = result.data.posts.edges.map(p => p.node);

      // Create blog pages
      posts
        .filter(post => post.slug.startsWith('/blog/'))
        .forEach(post => {
          upsertPage({
            path: post.slug,
            component: slash(templates.blogPost),
            context: {
              slug: post.slug
            }
          });
        });

      // Create tags pages
      posts
        .reduce((mem, post) =>
          cleanArray(mem.concat(get(post, 'frontmatter.tags')))
        , [])
        .forEach(tag => {
          upsertPage({
            path: `/blog/tags/${kebabCase(tag)}/`,
            component: slash(templates.tagsPage),
            context: {
              tag
            }
          });
        });

      // Create blog pagination
      const pageCount = Math.ceil(posts.length / POSTS_PER_PAGE);
      times(pageCount, index => {
        upsertPage({
          path: `/blog/page/${index + 1}/`,
          component: slash(templates.blogPage),
          context: {
            skip: index * POSTS_PER_PAGE
          }
        });
      });

      resolve();
    });
  });
};
