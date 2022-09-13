import * as React from 'react';
import ExternalLink from 'src/components/ExternalLink';
import { makeStyles, Theme } from 'src/components/core/styles';
import Paper from 'src/components/core/Paper';
import Grid from 'src/components/Grid/Grid';
import Typography from 'src/components/core/Typography';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    margin: `${theme.spacing(6)} 0`,
  },
  postTitle: {
    marginBottom: theme.spacing(2),
  },
  post: {
    marginBottom: theme.spacing(1) / 2,
    ...theme.typography.body1,
  },
  postLink: {
    color: theme.textColors.linkActiveLight,
    '&:hover': {
      color: theme.palette.primary.main,
      textDecoration: 'underline',
    },
  },
  withSeparator: {
    borderLeft: `1px solid ${theme.palette.divider}`,
    '&.MuiGrid-item': {
      paddingLeft: theme.spacing(4),
    },
  },
}));

const PopularPosts = () => {
  const classes = useStyles();

  const PopularDocs = (
    <React.Fragment>
      <div className={classes.post}>
        <ExternalLink
          link="https://www.linode.com/docs/getting-started/"
          text="Getting Started with Linode"
          className={classes.postLink}
          absoluteIcon
        />
      </div>
      <div className={classes.post}>
        <ExternalLink
          link="https://www.linode.com/docs/security/securing-your-server/"
          text="How to Secure Your Server"
          className={classes.postLink}
          absoluteIcon
        />
      </div>
      <div className={classes.post}>
        <ExternalLink
          link="https://www.linode.com/docs/troubleshooting/troubleshooting/"
          text="Troubleshooting"
          className={classes.postLink}
          absoluteIcon
        />
      </div>
    </React.Fragment>
  );

  const PopularForumPosts = (
    <React.Fragment>
      <div className={classes.post}>
        <ExternalLink
          link="https://www.linode.com/community/questions/323/my-linode-is-unreachable-after-maintenance"
          text="My Linode is unreachable after maintenance"
          className={classes.postLink}
          absoluteIcon
        />
      </div>
      <div className={classes.post}>
        <ExternalLink
          link="https://www.linode.com/community/questions/232/why-is-my-website-so-slow"
          text="Why is my website so slow?"
          className={classes.postLink}
          absoluteIcon
        />
      </div>
      <div className={classes.post}>
        <ExternalLink
          link="https://www.linode.com/community/questions/19082/i-just-created-my-first-linode-and-i-cant-send-emails-why"
          text="Ports 25, 465, and 587 blocked?"
          className={classes.postLink}
          absoluteIcon
        />
      </div>
    </React.Fragment>
  );

  return (
    <Paper className={classes.root} variant="outlined">
      <Grid container>
        <Grid item xs={12} sm={6} data-qa-documentation-link>
          <Typography variant="h3" className={classes.postTitle}>
            Most Popular Documentation:
          </Typography>
          {PopularDocs}
        </Grid>
        <Grid
          item
          xs={12}
          sm={6}
          className={classes.withSeparator}
          data-qa-community-link
        >
          <Typography variant="h3" className={classes.postTitle}>
            Most Popular Community Posts:
          </Typography>
          {PopularForumPosts}
        </Grid>
      </Grid>
    </Paper>
  );
};

export default PopularPosts;
